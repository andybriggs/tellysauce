import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { Title } from "@/types";
import HomeClient from "@/components/layout/HomeClient";

export default async function Home() {
  const [movieRows, tvRows] = await Promise.all([
    db
      .execute(sql`
        SELECT tmdb_id, title, poster, year, description
        FROM ai_popular_titles
        WHERE media_type = 'movie'
          AND fetched_date = (SELECT MAX(fetched_date) FROM ai_popular_titles WHERE media_type = 'movie')
        ORDER BY rank ASC
        LIMIT 10
      `)
      .catch(() => ({ rows: [] })),
    db
      .execute(sql`
        SELECT tmdb_id, title, poster, year, description
        FROM ai_popular_titles
        WHERE media_type = 'tv'
          AND fetched_date = (SELECT MAX(fetched_date) FROM ai_popular_titles WHERE media_type = 'tv')
        ORDER BY rank ASC
        LIMIT 10
      `)
      .catch(() => ({ rows: [] })),
  ]);

  const toTitles = (rows: unknown[], type: "movie" | "tv"): Title[] =>
    (rows as Record<string, unknown>[]).map((r) => ({
      id: r.tmdb_id as number,
      type,
      name: r.title as string,
      description: (r.description as string | null) ?? "",
      poster: r.poster as string | null,
      year: r.year as number | undefined,
      rating: 0,
    }));

  return (
    <HomeClient
      aiMovies={toTitles(movieRows.rows ?? [], "movie")}
      aiTv={toTitles(tvRows.rows ?? [], "tv")}
    />
  );
}
