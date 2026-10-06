import { db } from "@/db";
import { sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { randomUUID } from "crypto";
import { AI_POPULAR_TAG } from "@/server/aiPopular";
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
  /** Latest episode air date or release date, as the model reports it. */
  lastAired: string | null;
  quotes: RedditQuote[];
};

/**
 * The cron has no user, so AI picks are grounded to one configured market.
 * Making them genuinely per-region needs a `region` column on
 * ai_popular_titles and one run per region.
 */
const AI_POPULAR_REGION = (process.env.AI_POPULAR_REGION ?? "GB").toUpperCase();

/** Streaming services and editorial sources that actually exist in a market. */
const REGION_CONTEXT: Record<
  string,
  { market: string; services: string; sources: string[]; subreddits: string[] }
> = {
  GB: {
    market: "the United Kingdom and Ireland",
    services:
      "BBC iPlayer, ITVX, Channel 4, Sky/NOW, Netflix, Prime Video, Disney+, Apple TV+",
    sources: [
      "The Guardian TV reviews and What's On guides",
      "Radio Times",
      "The Times and Telegraph TV critics",
    ],
    subreddits: ["uktv", "britishtv"],
  },
  US: {
    market: "the United States and Canada",
    services:
      "Netflix, Hulu, Max, Prime Video, Disney+, Apple TV+, Paramount+, Peacock",
    sources: [
      "Variety and The Hollywood Reporter",
      "Vulture and The New York Times TV critics",
    ],
    subreddits: ["NetflixBestOf"],
  },
  AU: {
    market: "Australia and New Zealand",
    services:
      "ABC iview, SBS On Demand, Stan, BINGE, Netflix, Prime Video, Disney+, Apple TV+",
    sources: [
      "The Guardian Australia TV reviews",
      "The Sydney Morning Herald TV critics",
    ],
    subreddits: ["australiantv"],
  },
};

function regionContext(region: string) {
  return REGION_CONTEXT[region] ?? REGION_CONTEXT.GB;
}

/** ------------------------------------------------------------------ */
/** Stage 1: Grounded web search + JSON structuring in one call        */
/** ------------------------------------------------------------------ */

async function fetchGroundedTitles(mediaType: "movie" | "tv"): Promise<CronRec[]> {
  const kind = mediaType === "movie" ? "movies" : "TV shows";
  const isMovie = mediaType === "movie";
  const ctx = regionContext(AI_POPULAR_REGION);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  // The window the title itself must fall inside — "right now" is meaningless
  // to a model with no date anchor, so state the boundary explicitly.
  const windowDays = isMovie ? 70 : 56;
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const sourceLines = [
    `- IMDb: Most Popular ${isMovie ? "Movies" : "TV Shows"} chart`,
    `- Rotten Tomatoes: Most Popular and Certified Fresh ${kind} this week`,
    `- Metacritic: highest-scoring new ${isMovie ? "movie" : "TV"} releases`,
    ...ctx.sources.map((src) => `- ${src}`),
    `- Reddit: ${[
      ...(isMovie
        ? ["movies", "MovieSuggestions", "TrueFilm", "letterboxd"]
        : ["television", "NetflixBestOf"]),
      ...ctx.subreddits,
    ]
      .map((sub) => `r/${sub}`)
      .join(", ")} — high-upvote threads from the past 7 days`,
  ].join("\n");

  const prompt = `Today's date is ${today}. Use web search to find what is genuinely popular AS OF TODAY — do not rely on your own training knowledge, which is older than today's date and will give you stale titles.

TASK: find the 12 ${kind} that viewers in ${ctx.market} are most enthusiastic about right now.

SOURCES TO SEARCH:
${sourceLines}

Combine signals across sources. A title appearing in several is a strong signal. Prioritise genuine quality and audience enthusiasm over marketing noise.

RULES — follow all of these strictly:

1. RECENCY — this is the most important rule. ${
    isMovie
      ? `Every film must have had its cinema release or streaming debut between ${windowStart} and ${today}.`
      : `Every show must have had a NEW EPISODE broadcast or released between ${windowStart} and ${today}. A show whose latest season finished before ${windowStart} does not qualify, however good it was. Returning seasons of established shows are very much wanted — a long-running show airing a new season right now belongs on this list.`
  } If you cannot confirm from search results that a title meets this window, leave it out and find another.

2. INCLUDE LOCAL TITLES: ${ctx.market} produces its own ${kind}, and these are often missed in favour of big US releases. Actively look for domestic productions currently airing or just released there. At least 4 of the 12 should be ${
    isMovie ? "locally or co-produced" : "domestic or local co-productions"
  } if that many qualify.

3. AVAILABILITY: the title should be watchable in ${ctx.market} — in cinemas, on broadcast, or on one of: ${ctx.services}. Do not cite a service unavailable in that market.

4. GENRE BALANCE: spread across genres. At most 1 horror and at most 2 thrillers. No two titles from the same franchise. Exclude daily/continuing output entirely — no soaps, no talk shows, no panel shows, no news, no live sport, no reality competitions.

5. LANGUAGE: English-language productions, or productions with a major English-language release in ${ctx.market}. Exclude titles whose primary audience is outside Western markets unless they had a wide ${ctx.market} release and were reviewed by mainstream English-language critics.

6. NO DUPLICATES: every title exactly once.

For each title return:
- title: the exact ${isMovie ? "film" : "show"} name as it would appear on IMDb or TMDB
- year: ${isMovie ? "release year" : "year the show FIRST aired, not the current season's year"} as an integer, or null if unknown
- lastAired: the date of ${
    isMovie ? "its release" : "its most recent episode"
  } in YYYY-MM-DD form, as precisely as your search results support. This is evidence for rule 1 — do not guess it.
- description: what it is, 10 words or fewer
- reason: why it is popular right now, 10 words or fewer
- tags: 3-5 genre/style tags

Your entire response must be the JSON object described in the output schema — 12 titles, no preamble, no extra text.`;

  // Two, not three: a single call can sit for ~200s before the API returns a 429,
  // so a third attempt cannot fit inside the 300s maxDuration anyway.
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let text = "";

    try {
      const res = await openai.responses.create({
        model: "gpt-6-luna",
        tools: [
          {
            type: "web_search",
            search_context_size: "low",
            user_location: { type: "approximate", country: AI_POPULAR_REGION },
          },
        ],
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
                      lastAired: { anyOf: [{ type: "string" }, { type: "null" }] },
                    },
                    required: [
                      "title",
                      "description",
                      "reason",
                      "tags",
                      "year",
                      "lastAired",
                    ],
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
      text = res.output_text ?? "";
    } catch (err) {
      // A high-context web search is ~70-80k tokens, so a burst can trip the
      // per-minute token limit. That is worth waiting out rather than failing
      // the run — anything else is a real error and should surface immediately.
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt < MAX_ATTEMPTS) {
        const waitMs = 10_000 * attempt;
        console.warn(
          `[ai-popular] Rate limited for ${mediaType}, retrying in ${waitMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw err;
    }

    if (!text) {
      console.warn(
        `[ai-popular] OpenAI web search returned empty response for ${mediaType} (attempt ${attempt}/${MAX_ATTEMPTS})`
      );
      if (attempt < MAX_ATTEMPTS) continue;
      throw new Error(
        `OpenAI web search returned empty response for ${mediaType} after ${MAX_ATTEMPTS} attempts`
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
          `[ai-popular] Structured response contained 0 titles for ${mediaType} (attempt ${attempt}/${MAX_ATTEMPTS})`
        );
        if (attempt < MAX_ATTEMPTS) continue;
        throw new Error(
          `Structured response contained 0 titles for ${mediaType} after ${MAX_ATTEMPTS} attempts`
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
        lastAired: r.lastAired ?? null,
        quotes: [],
      }));
    } catch (err) {
      console.warn(
        `[ai-popular] Failed to parse structured response for ${mediaType} (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        err
      );
      if (attempt < MAX_ATTEMPTS) continue;
      throw new Error(
        `Failed to parse structured response for ${mediaType} after ${MAX_ATTEMPTS} attempts`
      );
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

  // One media type per invocation. Each grounded web search takes ~90s, so doing
  // both plus any 429 backoff overran the 300s maxDuration and the whole run was
  // lost to a FUNCTION_INVOCATION_TIMEOUT. vercel.json schedules movie and tv
  // separately; omitting the param still does both, which is handy for local runs.
  const typeParam = new URL(req.url).searchParams.get("type");
  if (typeParam && typeParam !== "movie" && typeParam !== "tv") {
    return Response.json(
      { error: "type must be 'movie' or 'tv'" },
      { status: 400 }
    );
  }
  const mediaTypes: Array<"movie" | "tv"> = typeParam
    ? [typeParam as "movie" | "tv"]
    : ["movie", "tv"];

  try {
    // Response keys stay "movies"/"tv" as before so existing callers and tests
    // do not have to care that invocations are now split.
    const counts: Record<string, number> = {};
    const skipped: string[] = [];
    const started = Date.now();
    // A grounded search takes ~90s, or ~200s when the API holds a rate-limited
    // request before rejecting it. Starting a second one past this point would
    // overrun maxDuration and lose the whole invocation to a 504, including the
    // media type that already succeeded. Better to return partial results.
    const SECOND_TYPE_CUTOFF_MS = 150_000;

    for (const mediaType of mediaTypes) {
      if (Date.now() - started > SECOND_TYPE_CUTOFF_MS) {
        console.warn(
          `[ai-popular] Skipping ${mediaType} — not enough time left in this invocation`
        );
        skipped.push(mediaType);
        continue;
      }

      const recs = await fetchGroundedTitles(mediaType);
      console.log(`[ai-popular] Stage 1 ${mediaType}: ${recs.length} recs`);
      if (recs.length === 0)
        console.error(`[ai-popular] Stage 1 produced 0 ${mediaType} recs`);

      const resolved = await resolveRecs(recs, mediaType);
      console.log(`[ai-popular] Stage 2 ${mediaType}: ${resolved.length} resolved`);

      await saveBatch(resolved, mediaType, fetchedDate);
      counts[mediaType === "movie" ? "movies" : "tv"] = resolved.length;
    }

    // The read helpers cache for 24h, so without this the new picks could sit
    // invisible behind a stale cache entry for most of a day. The rows are
    // already written by this point, so a failure here must not report the
    // whole job as failed - it just means the picks surface a bit later.
    try {
      revalidateTag(AI_POPULAR_TAG);
    } catch (err) {
      console.error("[ai-popular] revalidateTag failed:", err);
    }

    return Response.json({
      ok: true,
      fetchedDate,
      ...counts,
      ...(skipped.length ? { skipped } : {}),
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
