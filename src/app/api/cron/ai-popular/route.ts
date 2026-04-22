import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TMDB_BASE, fetchTMDBTitle } from "@/server/tmdb";
import type { RedditQuote } from "@/types/reddit";
import { openai } from "@/lib/ai";

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

type ResolvedTitle = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  description: string | null;
  reason: string;
  redditQuotes: RedditQuote[];
};

/** ------------------------------------------------------------------ */
/** Stage 1: Grounded web search + JSON structuring in one call        */
/** ------------------------------------------------------------------ */

async function fetchGroundedTitles(mediaType: "movie" | "tv"): Promise<CronRec[]> {
  const kind = mediaType === "movie" ? "movies" : "TV shows";
  const prompt = `Search Reddit right now — especially r/movies, r/television, r/MovieSuggestions, r/NetflixBestOf, r/TrueFilm, r/criterion, r/letterboxd — for the 10 most positively discussed ${kind} in the past 7 days.

IMPORTANT — Regional focus: Prioritise content that is popular in English-speaking countries (US, UK, Australia, Canada, Ireland) and Western Europe (France, Germany, Spain, Italy, etc.). You may include East Asian content ONLY if it has had a major mainstream crossover in Western markets (e.g. Squid Game, Parasite). Do not include content that is primarily popular within East Asian markets.

Focus on high-upvote threads, multi-community buzz, and genuine enthusiasm (not controversy).

For each title return:
- title: the film or show name
- year: release year as an integer if known, otherwise null
- description: what it is in 10 words or fewer
- reason: why it is popular right now in 8 words or fewer
- tags: 3–5 genre/style tags
- reddit_quote: a short quote (max 120 chars) capturing what enthusiastic viewers are saying about this title in Reddit discussions — reflect the genuine community sentiment you found
- subreddit: the subreddit name without the r/ prefix where the most discussion is happening (e.g. "movies")

If you cannot find a quote or subreddit for a title, set those fields to null.

Your entire response must be the JSON object described in the output schema — 10 titles, no preamble, no extra text.`;

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
                    reddit_quote: { anyOf: [{ type: "string" }, { type: "null" }] },
                    subreddit: { anyOf: [{ type: "string" }, { type: "null" }] },
                  },
                  required: ["title", "description", "reason", "tags", "year", "reddit_quote", "subreddit"],
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
        (r): r is CronRec & { reddit_quote: string | null; subreddit: string | null } =>
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

      return recs.map((r) => {
        const quotes: RedditQuote[] =
          r.reddit_quote && r.subreddit
            ? [
                {
                  text: r.reddit_quote.slice(0, 120),
                  subreddit: (r.subreddit as string).replace(/^r\//, ""),
                },
              ]
            : [];

        return {
          title: r.title,
          description: r.description,
          reason: r.reason,
          tags: r.tags,
          year: r.year,
          quotes,
        };
      });
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
    return data.results?.[0]?.id ?? null;
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

  await db.execute(sql`
    DELETE FROM ai_popular_titles
    WHERE media_type = ${mediaType} AND fetched_date = ${fetchedDate}
  `);

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];
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
