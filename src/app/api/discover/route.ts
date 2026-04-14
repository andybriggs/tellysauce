import { NextResponse } from "next/server";
import type { Title } from "@/types";
import { TMDB_BASE } from "@/server/tmdb";
import { db } from "@/db";
import { sql } from "drizzle-orm";

type TmdbResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
};

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

        return NextResponse.json({ titles });
      } catch (err: unknown) {
        // Table may not exist yet (migration pending) — return empty gracefully
        console.error("[discover] AI source query failed:", err instanceof Error ? err.message : err);
        return NextResponse.json({ titles: [] });
      }
    }

    // Recent: "popular" (time-weighted)
    // All: "top_rated" (brings older titles in)
    const path =
      timeframe === "all" ? `/${type}/top_rated` : `/${type}/popular`;

    const params = new URLSearchParams({
      language: "en-GB", // or "en-US"
      // region: "GB",   // optional; region behavior is documented by TMDB
      // page: "1",
    });

    const url = `${TMDB_BASE}${path}?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      },
      next: { revalidate: 60 * 30 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `TMDB error ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const data = await res.json();

    const titles: Title[] = (data.results ?? []).map((t: TmdbResult) => ({
      id: t.id,
      type,
      name: t.title ?? t.name ?? "",
      description: t.overview ?? "",
      poster: t.poster_path
        ? `https://image.tmdb.org/t/p/w500${t.poster_path}`
        : null,
    }));

    return NextResponse.json({ titles });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
