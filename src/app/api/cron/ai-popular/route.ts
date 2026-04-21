import { GoogleGenAI, Type } from "@google/genai";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TMDB_BASE, fetchTMDBTitle } from "@/server/tmdb";
import type { Rec } from "@/app/api/recommend/route";
import type { ModelResponse } from "@/lib/gemini";
import type { RedditQuote } from "@/types/reddit";

export const runtime = "nodejs";
export const maxDuration = 300;

/** ------------------------------------------------------------------ */
/** Types                                                               */
/** ------------------------------------------------------------------ */

// Extends the shared Rec type with quote data extracted from the Stage 1 grounded output
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
/** Helpers (mirrors recommend/route.ts)                                */
/** ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractModelText(res: unknown): {
  text: string;
  finishReason: string | null;
  blockReason: string | null;
} {
  const mr = isRecord(res) ? (res as ModelResponse) : undefined;
  if (mr?.text && typeof mr.text === "string") {
    return { text: mr.text, finishReason: null, blockReason: null };
  }
  const cand = mr?.candidates?.[0];
  const parts = cand?.content?.parts ?? [];
  const text = parts
    .map((p) => (p && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("");
  return {
    text,
    finishReason: cand?.finishReason ?? null,
    blockReason: mr?.promptFeedback?.blockReason ?? null,
  };
}

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^<<<END>>>$/.test(l));
}

function parseYearLoose(s: string | null | undefined): number | null {
  if (!s) return null;
  const paren = s.match(/\((19|20)\d{2}\)/);
  if (paren) return Number(paren[0].replace(/[()]/g, ""));
  const any = s.match(/\b(19|20)\d{2}\b/);
  return any ? Number(any[0]) : null;
}

function parseJsonArrayOfRecs(raw: string): CronRec[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((it): CronRec | null => {
          if (!isRecord(it)) return null;
          const title = typeof it.title === "string" ? it.title.trim() : "";
          if (!title) return null;
          const description =
            typeof it.description === "string" ? it.description.trim() : "";
          const reason = typeof it.reason === "string" ? it.reason.trim() : "";
          const tags = Array.isArray(it.tags)
            ? it.tags.map((t) => String(t))
            : [];
          const y = it.year;
          const year =
            typeof y === "number" && Number.isFinite(y)
              ? Math.trunc(y)
              : parseYearLoose(title) ?? null;
          const quotes: RedditQuote[] = Array.isArray(it.quotes)
            ? it.quotes
                .filter(
                  (q): q is { text: string; subreddit: string } =>
                    isRecord(q) &&
                    typeof q.text === "string" &&
                    typeof q.subreddit === "string"
                )
                .map((q) => ({
                  text: q.text.trim(),
                  subreddit: q.subreddit.trim().replace(/^r\//, ""),
                }))
                .slice(0, 3)
            : [];
          return { title, description, reason, tags, year, quotes };
        })
        .filter((x): x is CronRec => Boolean(x));
    }
  } catch {
    /* ignore */
  }
  return [];
}

/** ------------------------------------------------------------------ */
/** Stage 1: Grounded search via Gemini                                 */
/** ------------------------------------------------------------------ */

async function fetchGroundedTitles(
  ai: GoogleGenAI,
  mediaType: "movie" | "tv"
): Promise<string> {
  const kind = mediaType === "movie" ? "movies" : "TV shows";
  const prompt = `You are a film and TV expert monitoring online discussions.

Search Reddit right now — especially r/movies, r/television, r/MovieSuggestions, r/NetflixBestOf, r/TrueFilm, r/criterion, r/letterboxd — for the 10 most positively discussed ${kind} in the past 7 days.

IMPORTANT — Regional focus: Prioritise content that is popular in English-speaking countries (US, UK, Australia, Canada, Ireland) and Western Europe (France, Germany, Spain, Italy, etc.). You may include East Asian content ONLY if it has had a major mainstream crossover in Western markets (e.g. Squid Game, Parasite). Do not include content that is primarily popular within East Asian markets.

Focus on high-upvote threads, multi-community buzz, and genuine enthusiasm (not controversy).
Output EXACTLY 10 titles, NO preamble/numbering/URLs.
If you know the release year, include it in parentheses after the title.
END output with: <<<END>>>

FORMAT (repeat this block for each title, separated by ---):
Title (optional YYYY) | description <=10 words | why it's popular <=8 words | tag1, tag2
QUOTE: "a representative positive community reaction or quote from the discussion" — r/subreddit
QUOTE: "another reaction if a second is clearly available" — r/subreddit
---`;

  // Retry once if the model returns empty content (intermittent grounding failure)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res: unknown = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL_GROUNDED_HQ!,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseModalities: ["TEXT"],
        thinkingConfig: { thinkingBudget: 1024 },
        maxOutputTokens: 4096,
        temperature: 0.4,
        stopSequences: ["<<<END>>>"],
        candidateCount: 1,
      },
    });

    const { text, finishReason, blockReason } = extractModelText(res);

    if (!text) {
      const raw = res as Record<string, unknown>;
      const cand = (raw?.candidates as unknown[])?.[0] as Record<string, unknown> | undefined;
      console.error(`[ai-popular] Empty text diagnostic (attempt ${attempt}/2)`, {
        mediaType,
        finishReason,
        blockReason,
        hasTopLevelText: typeof (raw as { text?: unknown })?.text,
        candidatesLength: (raw?.candidates as unknown[] | undefined)?.length ?? 0,
        partsLength: ((cand?.content as { parts?: unknown[] } | undefined)?.parts ?? []).length,
        parts: JSON.stringify((cand?.content as { parts?: unknown[] } | undefined)?.parts ?? []).slice(0, 500),
        hasGroundingMetadata: !!cand?.groundingMetadata,
        groundingMetadataKeys: cand?.groundingMetadata ? Object.keys(cand.groundingMetadata as object) : [],
        groundingMetadataSample: JSON.stringify(cand?.groundingMetadata).slice(0, 800),
        fullCandidate: JSON.stringify(cand).slice(0, 1000),
      });
      if (attempt < 2) {
        console.warn(`[ai-popular] Retrying grounded search for ${mediaType}...`);
        continue;
      }
      throw new Error(
        `Gemini returned empty response for ${mediaType} after 2 attempts (finishReason=${finishReason}, blockReason=${blockReason})`
      );
    }

    const endIdx = text.indexOf("<<<END>>>");
    const trimmed = (endIdx >= 0 ? text.slice(0, endIdx) : text).trim();

    if (!trimmed) {
      if (attempt < 2) {
        console.warn(`[ai-popular] Retrying grounded search for ${mediaType} (empty trimmed text)...`);
        continue;
      }
      throw new Error(
        `Gemini returned empty response for ${mediaType} after 2 attempts (finishReason=${finishReason}, blockReason=${blockReason})`
      );
    }

    return trimmed;
  }

  // Unreachable but satisfies TypeScript
  throw new Error(`Gemini grounded search failed for ${mediaType}`);
}

/** ------------------------------------------------------------------ */
/** Stage 2: Structure grounded text into JSON                          */
/** ------------------------------------------------------------------ */

async function structureToRecs(
  ai: GoogleGenAI,
  groundedText: string
): Promise<CronRec[]> {
  // Count title blocks by the number of lines containing " | " (the title lines)
  const titleLineCount = parseLines(groundedText).filter(
    (l) => l.includes(" | ") && !l.startsWith("QUOTE:")
  ).length;

  const res: unknown = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
    contents: `Turn the following blocks into STRICT JSON.

Rules:
- Output ONLY JSON (no prose, no code fences).
- Each item: { "title", "description", "reason", "tags": [strings], "year": number|null, "quotes": [{text, subreddit}] }.
- Parse the title line (contains "|") for title, description, reason, tags, year.
- Parse QUOTE: lines into the "quotes" array (up to 3). Strip the "r/" prefix from subreddit names.
- If no QUOTE lines are present for a title, use an empty "quotes" array.
- If a 4-digit year appears in the title line, set "year" to that integer. If unknown, set null.
- Return exactly ${titleLineCount} items.

SOURCE:
${groundedText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            reason: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            year: { type: Type.INTEGER, nullable: true },
            quotes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  subreddit: { type: Type.STRING },
                },
                required: ["text", "subreddit"],
              },
            },
          },
          required: ["title", "description", "reason", "tags", "year", "quotes"],
          additionalProperties: false,
        },
      },
      temperature: 0.2,
      maxOutputTokens: 1200,
    },
  });

  const { text } = extractModelText(res);
  return parseJsonArrayOfRecs(text || "[]").filter((r) => r.title);
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
  // TMDB uses different year params per media type
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

  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < recs.length; i += 5) {
    const batch = recs.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (rec) => {
        try {
          const tmdbId = await searchTmdbId(rec.title, mediaType, rec.year);
          if (!tmdbId) {
            console.warn(`[ai-popular] Could not resolve TMDB ID for: ${rec.title}`);
            return null;
          }
          const tmdb = await fetchTMDBTitle(tmdbId, mediaType);
          if (!tmdb) {
            console.warn(`[ai-popular] fetchTMDBTitle returned null for id=${tmdbId}`);
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
    console.warn(`[ai-popular] Skipping save for ${mediaType} — 0 titles resolved, keeping existing data`);
    return;
  }

  await db.execute(sql`
    DELETE FROM ai_popular_titles
    WHERE media_type = ${mediaType} AND fetched_date = ${fetchedDate}
  `);

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];
    const quotesJson = r.redditQuotes.length > 0 ? JSON.stringify(r.redditQuotes) : null;
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

  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    return Response.json({ error: "Missing GOOGLE_GEMINI_API_KEY" }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
  const fetchedDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Stage 1: grounded search for movies and TV in parallel
    const [movieText, tvText] = await Promise.all([
      fetchGroundedTitles(ai, "movie"),
      fetchGroundedTitles(ai, "tv"),
    ]);

    // Stage 2: structure into JSON in parallel
    const [movieRecs, tvRecs] = await Promise.all([
      structureToRecs(ai, movieText),
      structureToRecs(ai, tvText),
    ]);

    // Resolve to TMDB IDs + enrich with poster/description
    const [movieResolved, tvResolved] = await Promise.all([
      resolveRecs(movieRecs, "movie"),
      resolveRecs(tvRecs, "tv"),
    ]);

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
      { error: "Cron job failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
