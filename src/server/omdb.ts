import { db } from "@/db";
import { sql } from "drizzle-orm";

export type TitleRatings = { imdbRating: string | null; rtRating: string | null };

const EMPTY: TitleRatings = { imdbRating: null, rtRating: null };

/**
 * How long a stored rating is served without re-asking OMDb. Ratings barely
 * move day to day, and the free tier only allows 1,000 requests/day, so one
 * call per title per day is the right trade.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

type CachedRow = {
  imdb_rating: string | null;
  rt_rating: string | null;
  fetched_at: string | Date;
};

async function readCached(imdbId: string): Promise<CachedRow | null> {
  try {
    const res = await db.execute(sql`
      SELECT imdb_rating, rt_rating, fetched_at
      FROM title_ratings
      WHERE imdb_id = ${imdbId}
      LIMIT 1
    `);
    return ((res.rows ?? [])[0] as CachedRow | undefined) ?? null;
  } catch (err) {
    // Table missing (migration pending) must not take out the title page.
    console.error(
      "[omdb] cache read failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function writeCached(imdbId: string, ratings: TitleRatings): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO title_ratings (imdb_id, imdb_rating, rt_rating, fetched_at)
      VALUES (${imdbId}, ${ratings.imdbRating}, ${ratings.rtRating}, NOW())
      ON CONFLICT (imdb_id) DO UPDATE
        SET imdb_rating = EXCLUDED.imdb_rating,
            rt_rating   = EXCLUDED.rt_rating,
            fetched_at  = NOW()
    `);
  } catch (err) {
    console.error(
      "[omdb] cache write failed:",
      err instanceof Error ? err.message : err
    );
  }
}

function toRatings(row: CachedRow): TitleRatings {
  return { imdbRating: row.imdb_rating, rtRating: row.rt_rating };
}

/** Returns null when OMDb could not be reached or refused the request. */
async function fetchFromOmdb(
  imdbId: string,
  revalidate: number
): Promise<TitleRatings | null> {
  const key = process.env.OMDB_API_KEY;
  if (!key) {
    console.warn("[omdb] OMDB_API_KEY is not set");
    return null;
  }

  let res: Response;
  try {
    res = await fetch(
      `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${key}`,
      { next: { revalidate } }
    );
  } catch (err) {
    console.warn(
      `[omdb] request failed for ${imdbId}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  if (!res.ok) {
    // 401 here is almost always "Request limit reached!" on the free tier.
    console.warn(`[omdb] HTTP ${res.status} for ${imdbId}`);
    return null;
  }

  const data = await res.json();
  if (data.Response === "False") {
    console.warn(`[omdb] refused ${imdbId}: ${data.Error}`);
    return null;
  }

  const imdbRating =
    data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null;
  const rtEntry = (data.Ratings ?? []).find(
    (r: { Source: string; Value: string }) => r.Source === "Rotten Tomatoes"
  );

  return { imdbRating, rtRating: rtEntry?.Value ?? null };
}

/**
 * IMDb and Rotten Tomatoes ratings, served from the DB where possible.
 *
 * The important behaviour is the failure path: when OMDb is unavailable or the
 * daily quota is spent, a previously stored rating is served even if stale,
 * rather than rendering "Rating unavailable" and baking that into the ISR cache
 * for an hour.
 */
export async function fetchIMDbRating(
  imdbId: string,
  revalidate: number
): Promise<TitleRatings> {
  const cached = await readCached(imdbId);

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < TTL_MS) return toRatings(cached);
  }

  const fresh = await fetchFromOmdb(imdbId, revalidate);

  if (fresh) {
    await writeCached(imdbId, fresh);
    return fresh;
  }

  // Stale beats empty.
  return cached ? toRatings(cached) : EMPTY;
}
