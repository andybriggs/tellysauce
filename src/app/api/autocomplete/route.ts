import { NextResponse } from "next/server";
import type { AutoCompleteResult } from "@/types";
import { rankSearchResults } from "@/lib/searchRank";

type TMDBBase = {
  id: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_count?: number;
};

type TMDBMovie = TMDBBase & {
  media_type: "movie";
  title?: string;
  release_date?: string;
};

type TMDBTV = TMDBBase & {
  media_type: "tv";
  name?: string;
  first_air_date?: string;
};

type TMDBPerson = { media_type: "person" };

type TMDBMultiResult = TMDBMovie | TMDBTV | TMDBPerson;

interface TMDBMultiSearchResponse {
  results?: TMDBMultiResult[];
}

export const runtime = "nodejs";

/**
 * TMDB pages fetched per query. Its relevance ordering is popularity-heavy, so
 * the closest title match can sit well down the list ("The Pirates! In an
 * Adventure with Scientists!" is 14th for "The Pirates!"). Two pages give the
 * re-ranker a pool of ~40 to pick from.
 */
const SEARCH_PAGES = 2;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ results: [] as AutoCompleteResult[] });
  }

  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Server misconfigured: missing TMDB_ACCESS_TOKEN", results: [] },
      { status: 500 }
    );
  }

  const pageUrl = (page: number) => {
    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", q);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("page", String(page));
    return url.toString();
  };
  const fetchPage = (page: number) =>
    fetch(pageUrl(page), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

  try {
    // Later pages are fetched in parallel and are best-effort: a failure there
    // just means a smaller pool, while page 1 failing fails the request.
    const [upstream, ...extraPages] = await Promise.all([
      fetchPage(1),
      ...Array.from({ length: SEARCH_PAGES - 1 }, (_, i) =>
        fetchPage(i + 2).catch(() => null)
      ),
    ]);

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `TMDB error: ${upstream.status}`, details: text, results: [] },
        { status: upstream.status }
      );
    }

    const data: TMDBMultiSearchResponse = await upstream.json();
    const extraResults = await Promise.all(
      extraPages.map(async (res) => {
        if (!res?.ok) return [];
        const json = (await res.json().catch(() => ({}))) as TMDBMultiSearchResponse;
        return json.results ?? [];
      })
    );

    const toImageUrl = (
      path: string | null | undefined,
      size: "w185" | "w300"
    ): string | null =>
      path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

    const seen = new Set<string>();
    const candidates = [...(data.results ?? []), ...extraResults.flat()]
      .filter(
        (x): x is TMDBMovie | TMDBTV =>
          x.media_type === "movie" || x.media_type === "tv"
      )
      // Pages can overlap when TMDB's ordering shifts between requests.
      .filter((x) => {
        const key = `${x.media_type}:${x.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const ranked = rankSearchResults(
      q,
      candidates.map((x) => ({
        x,
        title: (x.media_type === "movie" ? x.title : x.name) ?? "",
        voteCount: x.vote_count,
      }))
    ).map(({ x }) => x);

    const results: AutoCompleteResult[] = ranked
      .map((x) => {
        const isMovie = x.media_type === "movie";

        const title = isMovie ? x.title ?? "" : x.name ?? "";
        const date = isMovie ? x.release_date ?? "" : x.first_air_date ?? "";
        const year = date ? Number(date.slice(0, 4)) : undefined;

        const poster = toImageUrl(x.poster_path, "w185");
        const backdrop = toImageUrl(x.backdrop_path, "w300");

        return {
          id: x.id,
          name: title,
          type: x.media_type,
          year,
          poster,
          backdrop,
        };
      });

    return NextResponse.json({ results });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      {
        error: "Network error contacting TMDB",
        details: e.message,
        results: [],
      },
      { status: 502 }
    );
  }
}
