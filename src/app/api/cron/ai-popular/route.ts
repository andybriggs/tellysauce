import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TMDB_BASE, fetchTMDBTitle } from "@/server/tmdb";
import type { RedditQuote } from "@/types/reddit";
import { openai } from "@/lib/ai";
import { prioritiseNewTitles } from "./helpers";
import type { ResolvedTitle } from "./helpers";

export const runtime = "nodejs";
export const maxDuration = 300;

/** ------------------------------------------------------------------ */
/** Types                                                               */
/** ------------------------------------------------------------------ */

type CronRec = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  year: number | null;
  quotes: RedditQuote[];
};

/** ------------------------------------------------------------------ */
/** Stage 1: Grounded web search + JSON structuring in one call        */
/** ------------------------------------------------------------------ */

async function fetchGroundedTitles(mediaType: "movie" | "tv"): Promise<CronRec[]> {
  const kind = mediaType === "movie" ? "movies" : "TV shows";
  const currentYear = new Date().getFullYear();
  const prompt = `Search the following sources for the 12 most popular and well-received ${kind} right now:

SOURCES TO SEARCH:
- IMDb: Most Popular ${kind === "movies" ? "Movies" : "TV Shows"} chart and Top Rated recent releases
- Rotten Tomatoes: Most Popular and Certified Fresh ${kind === "movies" ? "movies" : "TV shows"} this week
- Metacritic: Highest-scoring new ${kind === "movies" ? "movie" : "TV"} releases
- Reddit: r/${kind === "movies" ? "movies, r/MovieSuggestions, r/TrueFilm, r/criterion, r/letterboxd" : "television, r/NetflixBestOf, r/television"} — high-upvote threads from the past 7 days

Combine signals from all sources. A title appearing across multiple sources is a strong signal. Prioritise genuine quality and audience enthusiasm.

RULES — follow all of these strictly:

1. RECENCY: Only include ${kind} released in ${currentYear - 2} or later. The only exception is a title released before ${currentYear - 2} that is trending RIGHT NOW due to a specific recent event (new season, award win, sequel) — at most 1 such exception.

2. MAINSTREAM APPEAL: Wide theatrical releases, major streaming titles (Netflix, Prime, Disney+, Apple TV+, HBO/Max), or shows with large viewership numbers. No niche cult titles.

3. GENRE BALANCE: Spread across genres. At most 1 horror or thriller. Prioritise drama, comedy, action, sci-fi, animation, documentary. No multiple titles from the same franchise.

4. REGIONAL FOCUS: English-speaking markets (US, UK, AU, CA, IE) and Western Europe. East Asian content only for major Western crossovers.

5. NO DUPLICATES: Every title must appear exactly once.

For each title return:
- title: the film or show name
- year: release year as an integer if known, otherwise null
- description: what it is in 10 words or fewer
- reason: why it is popular right now in 10 words or fewer
- tags: 3–5 genre/style tags

Your entire response must be the JSON object described in the output schema — 12 titles, no preamble, no extra text.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await openai.responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "title_list",
          strict: true,
          schema: {
            type: "object",
            properties: {
              titles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    reason: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                    year: { anyOf: [{ type: "integer" }, { type: "null" }] },
                  },
                  required: ["title", "description", "reason", "tags", "year"],
                  additionalProperties: false,
                },
              },
            },
            required: ["titles"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = res.output_text ?? "";

    if (!text) {
      console.warn(
        `[ai-popular] OpenAI web search returned empty response for ${mediaType} (attempt ${attempt}/2)`
      );
      if (attempt < 2) continue;
      throw new Error(
        `OpenAI web search returned empty response for ${mediaType} after 2 attempts`
      );
    }

    try {
      const parsed = JSON.parse(text) as { titles?: unknown[] };
      const recs = (parsed.titles ?? []).filter(
        (r): r is CronRec =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as Record<string, unknown>).title === "string" &&
          ((r as Record<string, unknown>).title as string).length > 0
      );

      if (recs.length === 0) {
        console.warn(
          `[ai-popular] Structured response contained 0 titles for ${mediaType} (attempt ${attempt}/2)`
        );
        if (attempt < 2) continue;
        throw new Error(
          `Structured response contained 0 titles for ${mediaType} after 2 attempts`
        );
      }

      // Deduplicate by normalised title (handles model repeating itself)
      const seen = new Set<string>();
      const unique = recs.filter((r) => {
        const key = r.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return unique.map((r) => ({
        title: r.title,
        description: r.description,
        reason: r.reason,
        tags: r.tags,
        year: r.year,
        quotes: [],
      }));
    } catch (err) {
      console.warn(`[ai-popular] Failed to parse structured response for ${mediaType} (attempt ${attempt}/2):`, err);
      if (attempt < 2) continue;
      throw new Error(`Failed to parse structured response for ${mediaType} after 2 attempts`);
    }
  }

  throw new Error(`OpenAI web search failed for ${mediaType}`);
}

/** ------------------------------------------------------------------ */
/** TMDB: search by title string to get TMDB ID                         */
/** ------------------------------------------------------------------ */

async function searchTmdbId(
  title: string,
  mediaType: "movie" | "tv",
  year?: number | null
): Promise<number | null> {
  const yearKey = mediaType === "tv" ? "first_air_date_year" : "year";
  const MIN_POPULARITY = 2;

  const search = async (withYear: boolean): Promise<number | null> => {
    const params = new URLSearchParams({ query: title, language: "en-US" });
    if (withYear && year) params.set(yearKey, String(year));

    const res = await fetch(`${TMDB_BASE}/search/${mediaType}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Pick the most popular result from the top 5 candidates above the minimum
    // threshold. Taking results[0] blindly can resolve to obscure documentaries
    // or clickbait titles that happen to match the query string exactly.
    const candidates: Array<{ id: number; popularity: number }> = (data.results ?? []).slice(0, 5);
    const best = candidates
      .filter((r) => (r.popularity ?? 0) >= MIN_POPULARITY)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

    return best?.id ?? null;
  };

  // Try with year first; if nothing comes back (common for TV shows where the
  // model returns a recent season year rather than the first-air year), retry
  // without the year filter.
  if (year) {
    const id = await search(true);
    if (id) return id;
  }

  return search(false);
}

/** ------------------------------------------------------------------ */
/** Resolve recs to enriched TMDB titles                                */
/** ------------------------------------------------------------------ */

async function resolveRecs(
  recs: CronRec[],
  mediaType: "movie" | "tv"
): Promise<ResolvedTitle[]> {
  const resolved: ResolvedTitle[] = [];

  for (let i = 0; i < recs.length; i += 5) {
    const batch = recs.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (rec) => {
        try {
          const tmdbId = await searchTmdbId(rec.title, mediaType, rec.year);
          if (!tmdbId) {
            console.warn(
              `[ai-popular] Could not resolve TMDB ID for: ${rec.title}`
            );
            return null;
          }
          const tmdb = await fetchTMDBTitle(tmdbId, mediaType);
          if (!tmdb) {
            console.warn(
              `[ai-popular] fetchTMDBTitle returned null for id=${tmdbId}`
            );
            return null;
          }
          if (!tmdb.poster) {
            console.warn(
              `[ai-popular] Skipping "${rec.title}" — resolved to "${tmdb.title}" with no poster (likely wrong resolution)`
            );
            return null;
          }
          return {
            tmdbId,
            title: tmdb.title,
            poster: tmdb.poster,
            year: tmdb.year,
            description: tmdb.description,
            reason: rec.reason,
            redditQuotes: rec.quotes,
          } satisfies ResolvedTitle;
        } catch (err) {
          console.warn(`[ai-popular] Error resolving "${rec.title}":`, err);
          return null;
        }
      })
    );
    resolved.push(...results.filter((r): r is ResolvedTitle => r !== null));
  }

  return resolved;
}

/** ------------------------------------------------------------------ */
/** DB: replace today's batch for a given media type                    */
/** ------------------------------------------------------------------ */

async function saveBatch(
  resolved: ResolvedTitle[],
  mediaType: "movie" | "tv",
  fetchedDate: string
) {
  if (resolved.length === 0) {
    console.warn(
      `[ai-popular] Skipping save for ${mediaType} — 0 titles resolved, keeping existing data`
    );
    return;
  }

  // Query the previous batch before deleting, so new titles can be ranked first.
  const prevRows = await db.execute(sql`
    SELECT tmdb_id FROM ai_popular_titles
    WHERE media_type = ${mediaType}
      AND fetched_date = (
        SELECT MAX(fetched_date) FROM ai_popular_titles WHERE media_type = ${mediaType}
      )
  `);
  const prevIds = new Set((prevRows?.rows ?? []).map((r) => r.tmdb_id as number));
  const ordered = prioritiseNewTitles(resolved, prevIds);

  await db.execute(sql`
    DELETE FROM ai_popular_titles
    WHERE media_type = ${mediaType} AND fetched_date = ${fetchedDate}
  `);

  for (let i = 0; i < ordered.length; i++) {
    const r = ordered[i];
    const quotesJson =
      r.redditQuotes.length > 0 ? JSON.stringify(r.redditQuotes) : null;
    await db.execute(sql`
      INSERT INTO ai_popular_titles
        (id, tmdb_id, media_type, title, poster, year, description, ai_reason, rank, fetched_date, reddit_quotes, created_at)
      VALUES
        (${randomUUID()}, ${r.tmdbId}, ${mediaType}, ${r.title}, ${r.poster},
         ${r.year}, ${r.description}, ${r.reason}, ${i + 1}, ${fetchedDate},
         ${quotesJson}::jsonb, now())
    `);
  }
}

/** ------------------------------------------------------------------ */
/** Handler                                                             */
/** ------------------------------------------------------------------ */

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  const fetchedDate = new Date().toISOString().slice(0, 10);

  try {
    // Stage 1: grounded web search + JSON structuring in a single call per media type
    const [movieRecs, tvRecs] = await Promise.all([
      fetchGroundedTitles("movie"),
      fetchGroundedTitles("tv"),
    ]);

    console.log(
      `[ai-popular] Stage 1 results: movies=${movieRecs.length}, tv=${tvRecs.length}`
    );
    if (movieRecs.length === 0)
      console.error("[ai-popular] Stage 1 produced 0 movie recs");
    if (tvRecs.length === 0)
      console.error("[ai-popular] Stage 1 produced 0 tv recs");

    // Stage 2: resolve to TMDB IDs + enrich with poster/description
    const [movieResolved, tvResolved] = await Promise.all([
      resolveRecs(movieRecs, "movie"),
      resolveRecs(tvRecs, "tv"),
    ]);

    console.log(
      `[ai-popular] Stage 2 results: movies=${movieResolved.length}, tv=${tvResolved.length}`
    );

    // Save to DB
    await Promise.all([
      saveBatch(movieResolved, "movie", fetchedDate),
      saveBatch(tvResolved, "tv", fetchedDate),
    ]);

    return Response.json({
      ok: true,
      fetchedDate,
      movies: movieResolved.length,
      tv: tvResolved.length,
    });
  } catch (err) {
    console.error("[ai-popular] Cron job failed:", err);
    return Response.json(
      {
        error: "Cron job failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
