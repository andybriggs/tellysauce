import { GoogleGenAI, Type } from "@google/genai";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TMDB_BASE, fetchTMDBTitle } from "@/server/tmdb";
import type { Rec } from "@/app/api/recommend/route";
import type { ModelResponse } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

/** ------------------------------------------------------------------ */
/** Types                                                               */
/** ------------------------------------------------------------------ */

type ResolvedTitle = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  description: string | null;
  reason: string;
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

function parseJsonArrayOfRecs(raw: string): Rec[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((it): Rec | null => {
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
          return { title, description, reason, tags, year };
        })
        .filter((x): x is Rec => Boolean(x));
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
Output EXACTLY 10 titles, one per line, NO preamble/numbering/URLs.
If you know the release year, include it in parentheses after the title.
END output with: <<<END>>>

FORMAT:
Title (optional YYYY) | description <=10 words | why it's popular <=8 words | tag1, tag2`;

  const res: unknown = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_GROUNDED_HQ!,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
      responseModalities: ["TEXT"],
      thinkingConfig: { thinkingBudget: 1024 },
      maxOutputTokens: 700,
      temperature: 0.4,
      stopSequences: ["<<<END>>>"],
      candidateCount: 1,
    },
  });

  const { text, finishReason, blockReason } = extractModelText(res);

  // Diagnostic: log raw response structure so we can see what the SDK returns when text is empty
  if (!text) {
    const raw = res as Record<string, unknown>;
    const cand = (raw?.candidates as unknown[])?.[0] as Record<string, unknown> | undefined;
    console.error("[ai-popular] Empty text diagnostic", {
      mediaType,
      finishReason,
      blockReason,
      hasTopLevelText: typeof (raw as { text?: unknown })?.text,
      candidatesLength: (raw?.candidates as unknown[] | undefined)?.length ?? 0,
      partsLength: ((cand?.content as { parts?: unknown[] } | undefined)?.parts ?? []).length,
      parts: JSON.stringify((cand?.content as { parts?: unknown[] } | undefined)?.parts ?? []).slice(0, 500),
      hasGroundingMetadata: !!cand?.groundingMetadata,
    });
  }

  const endIdx = text.indexOf("<<<END>>>");
  const trimmed = (endIdx >= 0 ? text.slice(0, endIdx) : text).trim();

  if (!trimmed) {
    throw new Error(
      `Gemini returned empty response for ${mediaType} (finishReason=${finishReason}, blockReason=${blockReason})`
    );
  }

  return trimmed;
}

/** ------------------------------------------------------------------ */
/** Stage 2: Structure grounded text into JSON                          */
/** ------------------------------------------------------------------ */

async function structureToRecs(
  ai: GoogleGenAI,
  groundedText: string
): Promise<Rec[]> {
  const lineCount = parseLines(groundedText).length;

  const res: unknown = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
    contents: `Turn the following lines into STRICT JSON.

Rules:
- Output ONLY JSON (no prose, no code fences).
- Each item: { "title", "description", "reason", "tags": [strings], "year": number|null }.
- If a 4-digit year appears in the line, set "year" to that integer. If unknown, set null.
- Keep descriptions concise.
- Return exactly ${lineCount} items.

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
          },
          required: ["title", "description", "reason", "tags", "year"],
          additionalProperties: false,
        },
      },
      temperature: 0.2,
      maxOutputTokens: 700,
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
  recs: Rec[],
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
    await db.execute(sql`
      INSERT INTO ai_popular_titles
        (id, tmdb_id, media_type, title, poster, year, description, ai_reason, rank, fetched_date, created_at)
      VALUES
        (${randomUUID()}, ${r.tmdbId}, ${mediaType}, ${r.title}, ${r.poster},
         ${r.year}, ${r.description}, ${r.reason}, ${i + 1}, ${fetchedDate}, now())
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
