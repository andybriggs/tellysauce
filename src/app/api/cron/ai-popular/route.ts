import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TMDB_BASE, fetchTMDBTitle } from "@/server/tmdb";
import type { Rec } from "@/app/api/recommend/route";
import type { RedditQuote } from "@/types/reddit";
import { openai } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

/** ------------------------------------------------------------------ */
/** Types                                                               */
/** ------------------------------------------------------------------ */

type CronRec = Rec & {
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
/** Stage 1: Grounded search via Perplexity Sonar Pro                  */
/** ------------------------------------------------------------------ */

async function fetchGroundedTitles(mediaType: "movie" | "tv"): Promise<string> {
  const kind = mediaType === "movie" ? "movies" : "TV shows";
  const prompt = `Search Reddit right now — especially r/movies, r/television, r/MovieSuggestions, r/NetflixBestOf, r/TrueFilm, r/criterion, r/letterboxd — for the 10 most positively discussed ${kind} in the past 7 days.

IMPORTANT — Regional focus: Prioritise content that is popular in English-speaking countries (US, UK, Australia, Canada, Ireland) and Western Europe (France, Germany, Spain, Italy, etc.). You may include East Asian content ONLY if it has had a major mainstream crossover in Western markets (e.g. Squid Game, Parasite). Do not include content that is primarily popular within East Asian markets.

Focus on high-upvote threads, multi-community buzz, and genuine enthusiasm (not controversy).
Output EXACTLY 10 titles, one per line, NO preamble/numbering/URLs.
If you know the release year, include it in parentheses after the title.

FORMAT:
Title (optional YYYY) | description <=10 words | why it's popular <=8 words | tag1, tag2`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await openai.responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
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

    const trimmed = text.trim();
    if (!trimmed) {
      if (attempt < 2) continue;
      throw new Error(
        `OpenAI web search returned empty trimmed response for ${mediaType} after 2 attempts`
      );
    }

    return trimmed;
  }

  throw new Error(`OpenAI web search failed for ${mediaType}`);
}

/** ------------------------------------------------------------------ */
/** Stage 2: Structure grounded text into JSON via OpenAI              */
/** ------------------------------------------------------------------ */

async function structureToRecs(groundedText: string): Promise<Rec[]> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Turn the following lines into JSON.

Rules:
- Only parse title lines (those containing "|"). Ignore any other text.
- For each title line: extract title, description, reason, tags (array), and year (integer or null).
- If a 4-digit year appears in the line (e.g., "Title (2024)"), set "year" to that integer.
- If unknown, set "year": null. Do not guess.
- Keep descriptions concise.

SOURCE:
${groundedText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
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
    temperature: 0.2,
    max_tokens: 1000,
  });

  const content = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { titles?: unknown[] };
  return (parsed.titles ?? []).filter(
    (r): r is Rec =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as Rec).title === "string" &&
      (r as Rec).title.length > 0
  );
}

/** ------------------------------------------------------------------ */
/** TMDB: search by title string to get TMDB ID                         */
/** ------------------------------------------------------------------ */

async function searchTmdbId(
  title: string,
  mediaType: "movie" | "tv",
  year?: number | null
): Promise<number | null> {
  const params = new URLSearchParams({ query: title, language: "en-US" });
  if (year) {
    params.set(
      mediaType === "tv" ? "first_air_date_year" : "year",
      String(year)
    );
  }

  const url = `${TMDB_BASE}/search/${mediaType}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  const first = data.results?.[0];
  return first?.id ?? null;
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
/** Stage 3.5: Generate community quotes for resolved titles via OpenAI */
/** ------------------------------------------------------------------ */

async function generateQuotesForTitles(
  titles: string[]
): Promise<RedditQuote[][]> {
  if (titles.length === 0) return [];

  const list = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `For each film or TV show below, write 2 short representative quotes (max 120 chars each) that reflect what enthusiastic viewers are saying about it online — the kind of thing you'd see in Reddit film communities like r/movies or r/television. Each quote should feel genuine and specific to that title.

Use real subreddit names without the r/ prefix (e.g. "movies", "television", "TrueFilm").

TITLES:
${list}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "quotes",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    quotes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          subreddit: { type: "string" },
                        },
                        required: ["text", "subreddit"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["quotes"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      items?: Array<{ quotes: RedditQuote[] }>;
    };
    return (parsed.items ?? []).map((item) =>
      (item.quotes ?? [])
        .filter(
          (q) => typeof q.text === "string" && typeof q.subreddit === "string"
        )
        .map((q) => ({
          text: q.text.trim(),
          subreddit: q.subreddit.trim().replace(/^r\//, ""),
        }))
        .slice(0, 2)
    );
  } catch {
    console.warn("[ai-popular] generateQuotesForTitles failed");
    return titles.map(() => []);
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
    // Stage 1: grounded search for movies and TV in parallel
    const [movieText, tvText] = await Promise.all([
      fetchGroundedTitles("movie"),
      fetchGroundedTitles("tv"),
    ]);

    // Stage 2: structure into JSON in parallel
    const [movieRecs, tvRecs] = await Promise.all([
      structureToRecs(movieText),
      structureToRecs(tvText),
    ]);

    console.log(
      `[ai-popular] Stage 2 results: movies=${movieRecs.length}, tv=${tvRecs.length}`
    );
    if (movieRecs.length === 0)
      console.error(
        "[ai-popular] Stage 2 produced 0 movie recs. Raw text sample:",
        movieText.slice(0, 500)
      );
    if (tvRecs.length === 0)
      console.error(
        "[ai-popular] Stage 2 produced 0 tv recs. Raw text sample:",
        tvText.slice(0, 500)
      );

    const movieCronRecs: CronRec[] = movieRecs.map((rec) => ({
      ...rec,
      quotes: [],
    }));
    const tvCronRecs: CronRec[] = tvRecs.map((rec) => ({ ...rec, quotes: [] }));

    // Stage 3: resolve to TMDB IDs + enrich with poster/description
    const [movieResolved, tvResolved] = await Promise.all([
      resolveRecs(movieCronRecs, "movie"),
      resolveRecs(tvCronRecs, "tv"),
    ]);

    console.log(
      `[ai-popular] Stage 3 results: movies=${movieResolved.length}, tv=${tvResolved.length}`
    );

    // Stage 3.5: generate community quotes for resolved titles
    const [movieQuotes, tvQuotes] = await Promise.all([
      generateQuotesForTitles(movieResolved.map((r) => r.title)),
      generateQuotesForTitles(tvResolved.map((r) => r.title)),
    ]);
    movieResolved.forEach((r, i) => {
      r.redditQuotes = movieQuotes[i] ?? [];
    });
    tvResolved.forEach((r, i) => {
      r.redditQuotes = tvQuotes[i] ?? [];
    });

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
