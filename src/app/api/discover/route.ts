import { NextResponse } from "next/server";
import type { Title } from "@/types";
import { TMDB_BASE } from "@/server/tmdb";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { regionOriginCountries } from "@/lib/region";
import {
  dropEvergreenSeries,
  mergePages,
  daysAgo,
  today,
  EXCLUDED_TV_GENRES,
  EXCLUDED_TV_GENRES_ALLTIME,
  REGIONAL_AIR_WINDOW_DAYS,
  RECENT_TV_AIR_WINDOW_DAYS,
  RECENT_MOVIE_RELEASE_WINDOW_DAYS,
} from "@/lib/discover";

type MediaType = "movie" | "tv";

type TmdbResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

/** Region-scoped TV: what is actually airing in the viewer's market right now. */
function regionalTvParams(region: string): URLSearchParams {
  return new URLSearchParams({
    language: "en-GB",
    with_origin_country: regionOriginCountries(region).join("|"),
    "air_date.gte": daysAgo(REGIONAL_AIR_WINDOW_DAYS),
    without_genres: EXCLUDED_TV_GENRES.join(","),
    "vote_count.gte": "20",
    sort_by: "popularity.desc",
  });
}

function recentParams(type: MediaType): URLSearchParams {
  if (type === "tv") {
    return new URLSearchParams({
      language: "en-GB",
      with_original_language: "en",
      "air_date.gte": daysAgo(RECENT_TV_AIR_WINDOW_DAYS),
      without_genres: EXCLUDED_TV_GENRES.join(","),
      "vote_count.gte": "50",
      sort_by: "popularity.desc",
    });
  }
  return new URLSearchParams({
    language: "en-GB",
    with_original_language: "en",
    "primary_release_date.gte": daysAgo(RECENT_MOVIE_RELEASE_WINDOW_DAYS),
    // Without an upper bound TMDB returns unreleased titles with inflated scores.
    "primary_release_date.lte": today(),
    "vote_count.gte": "30",
    sort_by: "popularity.desc",
  });
}

function allTimeParams(type: MediaType): URLSearchParams {
  if (type === "tv") {
    return new URLSearchParams({
      language: "en-GB",
      with_original_language: "en",
      "first_air_date.lte": today(),
      without_genres: EXCLUDED_TV_GENRES_ALLTIME.join(","),
      "vote_count.gte": "1500",
      sort_by: "vote_average.desc",
    });
  }
  return new URLSearchParams({
    language: "en-GB",
    with_original_language: "en",
    "primary_release_date.lte": today(),
    // 500 was low enough that barely-released films outranked the classics.
    "vote_count.gte": "5000",
    sort_by: "vote_average.desc",
  });
}

async function fetchTmdbPages(
  type: MediaType,
  params: URLSearchParams,
  pages: number
): Promise<TmdbResult[]> {
  const responses = await Promise.all(
    Array.from({ length: pages }, (_, i) => {
      const p = new URLSearchParams(params);
      p.set("page", String(i + 1));
      return fetch(`${TMDB_BASE}/discover/${type}?${p.toString()}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
        },
        next: { revalidate: 60 * 30 },
      });
    })
  );

  const failed = responses.find((r) => !r.ok);
  if (failed) {
    const text = await failed.text().catch(() => "");
    throw Object.assign(new Error(`TMDB error ${failed.status}`), {
      status: failed.status,
      details: text,
    });
  }

  const data = await Promise.all(responses.map((r) => r.json()));
  return mergePages<TmdbResult>(data);
}

function toTitle(t: TmdbResult, type: MediaType): Title {
  const date = t.release_date ?? t.first_air_date ?? "";
  const year = Number(date.slice(0, 4));
  return {
    id: t.id,
    type,
    name: t.title ?? t.name ?? "",
    description: t.overview ?? "",
    poster: t.poster_path
      ? `https://image.tmdb.org/t/p/w500${t.poster_path}`
      : null,
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    rating: 0,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const timeframe = searchParams.get("timeframe"); // "recent" | "all"

    if (type !== "movie" && type !== "tv") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const source = searchParams.get("source");

    if (source === "ai") {
      try {
        const rows = await db.execute(sql`
          SELECT tmdb_id, title, poster, year, description, rank
          FROM ai_popular_titles
          WHERE media_type = ${type}
            AND fetched_date = (
              SELECT MAX(fetched_date) FROM ai_popular_titles WHERE media_type = ${type}
            )
          ORDER BY rank ASC
          LIMIT 10
        `);

        const titles: Title[] = (rows.rows ?? []).map((r) => ({
          id: r.tmdb_id as number,
          type,
          name: r.title as string,
          description: (r.description as string | null) ?? "",
          poster: r.poster as string | null,
          year: r.year as number | undefined,
          rating: 0,
        }));

        return NextResponse.json({ titles }, {
          headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
        });
      } catch (err: unknown) {
        // Table may not exist yet (migration pending) — return empty gracefully
        console.error("[discover] AI source query failed:", err instanceof Error ? err.message : err);
        return NextResponse.json({ titles: [] });
      }
    }

    if (source === "regional") {
      // Regional treatment is TV-only: recent GB/IE/AU film releases are mostly
      // obscure indies, so there is nothing worth carouselling.
      if (type !== "tv") {
        return NextResponse.json(
          { error: "source=regional is only supported for type=tv" },
          { status: 400 }
        );
      }
      const region = searchParams.get("region") ?? "GB";
      // Two pages because the evergreen filter removes a good chunk of page 1.
      const merged = await fetchTmdbPages(type, regionalTvParams(region), 2);
      const titles = dropEvergreenSeries(merged)
        .slice(0, 20)
        .map((t) => toTitle(t, type));
      return NextResponse.json({ titles });
    }

    const isAllTime = timeframe === "all";
    const params = isAllTime ? allTimeParams(type) : recentParams(type);
    // Only the recent-TV list gets post-filtered, so only it needs the extra page.
    const needsExtraPage = type === "tv" && !isAllTime;
    const merged = await fetchTmdbPages(type, params, needsExtraPage ? 2 : 1);

    const filtered =
      type === "tv" && !isAllTime ? dropEvergreenSeries(merged) : merged;

    const titles: Title[] = filtered.slice(0, 20).map((t) => toTitle(t, type));

    return NextResponse.json({ titles });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status) {
      return NextResponse.json(
        { error: `TMDB error ${status}`, details: (err as { details?: string }).details ?? "" },
        { status: 502 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
