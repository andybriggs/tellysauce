import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { searchTmdbByTitle, tmdbImg } from "@/server/tmdb";
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
- IMDb: US Most Popular ${kind === "movies" ? "Movies" : "TV Shows"} chart (US ranking only — ignore the global chart which is skewed by non-Western audiences) and Top Rated recent releases
- Rotten Tomatoes: Most Popular and Certified Fresh ${kind === "movies" ? "movies" : "TV shows"} this week
- Metacritic: Highest-scoring new ${kind === "movies" ? "movie" : "TV"} releases
- Reddit: r/${kind === "movies" ? "movies, r/MovieSuggestions, r/TrueFilm, r/criterion, r/letterboxd" : "television, r/NetflixBestOf, r/television"} — high-upvote threads from the past 7 days

Combine signals from all sources. A title appearing across multiple sources is a strong signal. Prioritise genuine quality and audience enthusiasm.

RULES — follow all of these strictly:

1. RECENCY: Only include ${kind} released in ${currentYear - 2} or later. The only exception is a title released before ${currentYear - 2} that is trending RIGHT NOW due to a specific recent event (new season, award win, sequel) — at most 1 such exception.

2. MAINSTREAM APPEAL: Wide theatrical releases, major streaming titles (Netflix, Prime, Disney+, Apple TV+, HBO/Max), or shows with large viewership numbers. No niche cult titles.

3. GENRE BALANCE: Spread across genres. At most 1 horror or thriller. Prioritise drama, comedy, action, sci-fi, animation, documentary. No multiple titles from the same franchise.

4. REGIONAL FOCUS: English-speaking markets (US, UK, AU, CA, IE) and Western Europe. Exclude all non-Western productions (South Asian, East Asian, etc.) unless the title was: (a) distributed theatrically in US/UK cinemas by a major studio or streamer, AND (b) reviewed positively by mainstream English-language critics (e.g. The Guardian, NYT, Variety, IndieWire). High IMDb global rankings or large diaspora viewership in English-speaking countries do NOT count as crossover. Bollywood titles are excluded unless they meet both criteria above.

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
      batch.map(async (rec): Promise<ResolvedTitle | null> => {
        try {
          const hit = await searchTmdbByTitle(rec.title, mediaType, rec.year);
          if (!hit) {
            console.warn(`[ai-popular] Could not resolve TMDB ID for: ${rec.title}`);
            return null;
          }
          const poster = tmdbImg.posterLarge(hit.posterPath);
          if (!poster) {
            console.warn(
              `[ai-popular] Skipping "${rec.title}" — resolved to "${hit.title}" with no poster (likely wrong resolution)`
            );
            return null;
          }
          return {
            tmdbId: hit.id,
            title: hit.title,
            poster,
            year: hit.year,
            description: hit.overview,
            reason: rec.reason,
            redditQuotes: rec.quotes,
          };
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
