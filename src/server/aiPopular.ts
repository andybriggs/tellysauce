import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { Title } from "@/types";
import type { RedditQuote } from "@/types/reddit";

export async function fetchAiPopularTitles(
  mediaType: "movie" | "tv"
): Promise<Title[]> {
  try {
    const result = await db.execute(sql`
      SELECT tmdb_id, title, poster, year, description
      FROM ai_popular_titles
      WHERE media_type = ${mediaType}
        AND fetched_date = (SELECT MAX(fetched_date) FROM ai_popular_titles WHERE media_type = ${mediaType})
      ORDER BY rank ASC
      LIMIT 10
    `);

    return (result.rows ?? []).map((r) => ({
      id: r.tmdb_id as number,
      type: mediaType,
      name: r.title as string,
      description: (r.description as string | null) ?? "",
      poster: r.poster as string | null,
      year: r.year as number | undefined,
      rating: 0,
    }));
  } catch {
    return [];
  }
}

export type AiPopularData = {
  aiReason: string | null;
  redditQuotes: RedditQuote[];
};

export async function fetchAiPopularData(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<AiPopularData | null> {
  try {
    const result = await db.execute(sql`
      SELECT ai_reason, reddit_quotes
      FROM ai_popular_titles
      WHERE tmdb_id = ${tmdbId}
        AND media_type = ${mediaType}
        AND fetched_date = (
          SELECT MAX(fetched_date)
          FROM ai_popular_titles
          WHERE media_type = ${mediaType}
        )
      LIMIT 1
    `);

    const row = result.rows?.[0];
    if (!row) return null;

    const rawQuotes = row.reddit_quotes;
    const redditQuotes: RedditQuote[] = Array.isArray(rawQuotes) ? rawQuotes : [];

    return {
      aiReason: (row.ai_reason as string | null) ?? null,
      redditQuotes,
    };
  } catch {
    return null;
  }
}
