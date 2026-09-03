import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { Title } from "@/types";
import type { RedditQuote } from "@/types/reddit";

const fetchAiPopularTitlesUncached = async (
  mediaType: "movie" | "tv"
): Promise<Title[]> => {
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
};

export async function fetchAiPopularTitles(
  mediaType: "movie" | "tv"
): Promise<Title[]> {
  try {
    return await unstable_cache(
      () => fetchAiPopularTitlesUncached(mediaType),
      [`ai-popular-${mediaType}`],
      { revalidate: 86400 }
    )();
  } catch {
    return [];
  }
}

export type AiPopularData = {
  aiReason: string | null;
  redditQuotes: RedditQuote[];
};

// Keyed by tmdb_id. There are only ~10 rows per media type per day, so the
// whole day's panel data fits in one cache entry.
type AiPopularDataMap = Record<string, AiPopularData>;

const fetchAiPopularDataMapUncached = async (
  mediaType: "movie" | "tv"
): Promise<AiPopularDataMap> => {
  const result = await db.execute(sql`
    SELECT tmdb_id, ai_reason, reddit_quotes
    FROM ai_popular_titles
    WHERE media_type = ${mediaType}
      AND fetched_date = (
        SELECT MAX(fetched_date)
        FROM ai_popular_titles
        WHERE media_type = ${mediaType}
      )
  `);

  const map: AiPopularDataMap = {};
  for (const row of result.rows ?? []) {
    const rawQuotes = row.reddit_quotes;
    map[String(row.tmdb_id)] = {
      aiReason: (row.ai_reason as string | null) ?? null,
      redditQuotes: Array.isArray(rawQuotes) ? rawQuotes : [],
    };
  }
  return map;
};

// One cache key per media type, not one per title. Crawlers walk arbitrary
// title ids, so a per-title key never hits and every bot request became a
// Neon wakeup - and a wakeup bills the full idle suspend window, not the
// 10ms the query takes. The cron writes this table once a day, so a 24h
// revalidate is as fresh as the data ever gets.
export async function fetchAiPopularData(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<AiPopularData | null> {
  try {
    const map = await unstable_cache(
      () => fetchAiPopularDataMapUncached(mediaType),
      [`ai-popular-data-map-${mediaType}`],
      { revalidate: 86400 }
    )();
    return map[String(tmdbId)] ?? null;
  } catch {
    return null;
  }
}
