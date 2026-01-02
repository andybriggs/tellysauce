import { NextRequest } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { buildRecKey } from "@/lib/recs";
import { SeedInput } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ------------------------------------------------------------------ */
/** Types                                                              */
/** ------------------------------------------------------------------ */

export type Rec = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  year?: number | null;
};

type TitleInput = {
  title?: string;
  name?: string;
  rating?: number;
  score?: number;
  userRating?: number;
};

type WatchListItem = string | { title?: string; name?: string };

type ProfilePayload = {
  mode?: "profile";
  titles: TitleInput[];
  watchList?: WatchListItem[];
  count?: number;
};

type SeedPayload = {
  mode: "seed";
  seed: SeedInput;
  watchList?: WatchListItem[];
  count?: number;
};

type RecommendBody = ProfilePayload | SeedPayload;

type ModelPart = { text?: string };
type ModelContent = { parts?: ModelPart[] };
type ModelCandidate = {
  content?: ModelContent;
  finishReason?: string | null;
};
type ModelResponse = {
  candidates?: ModelCandidate[];
  promptFeedback?: { blockReason?: string | null };
  text?: string; // some Gemini SDK responses surface .text on structuring runs
};

// Minimal shape of a db.execute result we rely on
type ExecResult = { rows?: Array<{ id?: string }> };

const ensureTablesOnce = (async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recommendation_sets (
      id              text PRIMARY KEY,
      user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key             text NOT NULL,
      user_key        text NOT NULL UNIQUE, -- user_key = user_id || ':' || key
      origin          text NOT NULL,        -- "PROFILE" | "SEED" | "CUSTOM_LIST"
      source          text NOT NULL DEFAULT 'GEMINI',
      input_snapshot  jsonb NOT NULL,

      seed_media_type text,
      seed_tmdb_id    integer,
      seed_imdb_id    text,
      seed_title      text,

      cache_version   text NOT NULL DEFAULT '1',
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      expires_at      timestamptz,
      is_stale        boolean NOT NULL DEFAULT false
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recommendation_items (
      id                   text PRIMARY KEY,
      set_id               text NOT NULL REFERENCES recommendation_sets(id) ON DELETE CASCADE,
      rank                 integer NOT NULL,

      title                text NOT NULL,
      description          text,
      reason               text,
      tags                 text[],

      suggested_media_type text,
      suggested_tmdb_id    integer,
      suggested_imdb_id    text,

      raw_json             jsonb NOT NULL,

      created_at           timestamptz NOT NULL DEFAULT now(),
      updated_at           timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'recommendation_items_set_rank_idx'
      ) THEN
        CREATE INDEX recommendation_items_set_rank_idx ON recommendation_items (set_id, rank);
      END IF;
    END
    $$;
  `);
})();

/** ------------------------------------------------------------------ */
/** Utility + type guards                                              */
/** ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStringSafe(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

function getOptionalYear(v: unknown): number | null | undefined {
  if (!isRecord(v)) return undefined;
  const y = (v as { year?: unknown }).year;
  if (typeof y === "number" && Number.isFinite(y)) return Math.trunc(y);
  if (y == null) return null;
  return undefined;
}

function isRecLike(v: unknown): v is Rec {
  if (!isRecord(v)) return false;
  const t = v.title;
  const d = v.description;
  const r = v.reason;
  const g = v.tags;
  const y = getOptionalYear(v);
  const yearOk =
    y === undefined ||
    y === null ||
    (typeof y === "number" && Number.isFinite(y));
  return (
    typeof t === "string" &&
    typeof d === "string" &&
    typeof r === "string" &&
    Array.isArray(g) &&
    g.every((x) => typeof x === "string") &&
    yearOk
  );
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
          if (isRecLike(it)) {
            const y = getOptionalYear(it);
            return { ...it, year: typeof y === "number" ? Math.trunc(y) : y };
          }
          if (isRecord(it)) {
            const title = toStringSafe(it.title).trim();
            if (!title) return null;
            const description = toStringSafe(it.description ?? "").trim();
            const reason = toStringSafe(it.reason ?? "").trim();
            const tagsRaw = Array.isArray(it.tags) ? it.tags : [];
            const tags = tagsRaw.map((t) => toStringSafe(t));

            // year: explicit field if valid, else parse from text/tags
            const explicitY = getOptionalYear(it);
            const year =
              explicitY !== undefined
                ? explicitY
                : parseYearLoose(title) ??
                  parseYearLoose(tags.join(" ")) ??
                  null;

            return { title, description, reason, tags, year };
          }
          return null;
        })
        .filter((x): x is Rec => Boolean(x));
    }
  } catch {
    /* ignore parse errors */
  }
  return [];
}

function extractModelText(res: unknown): {
  text: string;
  finishReason: string | null;
  blockReason: string | null;
  partsCount: number;
} {
  const mr = (isRecord(res) ? (res as ModelResponse) : undefined) ?? undefined;
  if (mr?.text && typeof mr.text === "string") {
    return {
      text: mr.text,
      finishReason: null,
      blockReason: null,
      partsCount: 0,
    };
  }
  const cand = mr?.candidates?.[0];
  const parts = cand?.content?.parts ?? [];
  const pieces = parts
    .map((p) => (p && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean);
  const text = pieces.join("");
  const finishReason = cand?.finishReason ?? null;
  const blockReason = mr?.promptFeedback?.blockReason ?? null;
  return { text, finishReason, blockReason, partsCount: parts.length };
}

function slugTitle(raw: string) {
  if (!raw) return "";
  let s = raw.replace(/\(\s*\d{4}\s*\)/g, "").replace(/\b\d{4}\b/g, "");
  s = s.split(":")[0].split(" - ")[0];
  s = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function makeForbiddenSet(input: unknown[]): Set<string> {
  const set = new Set<string>();
  for (const item of input ?? []) {
    let t = "";
    if (typeof item === "string") {
      t = item;
    } else if (isRecord(item)) {
      const maybeTitle = item.title;
      const maybeName = item.name;
      t =
        (typeof maybeTitle === "string" && maybeTitle) ||
        (typeof maybeName === "string" && maybeName) ||
        "";
    }
    const slug = slugTitle(toStringSafe(t));
    if (slug) set.add(slug);
    if (slug.includes("season"))
      set.add(slug.replace(/\bseason\s+\d+\b/, "").trim());
  }
  return set;
}

function uniqueAllowedLines(lines: string[], forbidden: Set<string>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const title = line.split("|")[0]?.trim() || "";
    const slug = slugTitle(title);
    if (!slug) continue;
    if (forbidden.has(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(line);
  }
  return out;
}

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^<<<END>>>$/.test(l));
}

function brief(str?: string | null, max = 240) {
  if (!str) return "";
  const s = String(str).trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** ------------------------------------------------------------------ */
/** Model → JSON structuring (captures year)                            */
/** ------------------------------------------------------------------ */

async function structureToJson(
  ai: GoogleGenAI,
  groundedText: string,
  targetCount: number
): Promise<Rec[]> {
  const structuringRes: unknown = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
    contents: `
Turn the following lines into STRICT JSON.

Rules:
- Output ONLY JSON (no prose, no code fences).
- Each item: { "title", "description", "reason", "tags": [strings], "year": number|null }.
- If a 4-digit year appears in the line (e.g., "Title (2024)" or as a tag), set "year" to that integer.
- If unknown, set "year": null. Do not guess.
- Keep descriptions concise; normalize tags to short labels (genres/language/year).
- Return exactly ${Math.min(
      targetCount,
      groundedText.split("\n").filter(Boolean).length
    )} items.

SOURCE:
${groundedText}
`,
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

  const { text } = extractModelText(structuringRes);
  const parsed = parseJsonArrayOfRecs(text || "[]");
  return parsed.filter((r) => r.title);
}

/** ------------------------------------------------------------------ */
/** Persistence (raw SQL; typed inputs)                                 */
/** ------------------------------------------------------------------ */

async function upsertRecommendationSet(params: {
  userId: string;
  key: string;
  origin: "PROFILE" | "SEED" | "CUSTOM_LIST";
  source?: string;
  inputSnapshot: unknown;
  seedMediaType?: string | null;
  seedTmdbId?: number | null;
  seedImdbId?: string | null;
  seedTitle?: string | null;
  cacheVersion?: string;
  expiresAt?: Date | null;
}) {
  const {
    userId,
    key,
    origin,
    source = "GEMINI",
    inputSnapshot,
    seedMediaType = null,
    seedTmdbId = null,
    seedImdbId = null,
    seedTitle = null,
    cacheVersion = process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3",
    expiresAt = null,
  } = params;

  const userKey = `${userId}:${key}`;
  const now = new Date();
  const id = randomUUID();

  const result = (await db.execute(sql`
    INSERT INTO recommendation_sets (
      id, user_id, key, user_key, origin, source, input_snapshot,
      seed_media_type, seed_tmdb_id, seed_imdb_id, seed_title,
      cache_version, created_at, updated_at, expires_at, is_stale
    )
    VALUES (
      ${id}, ${userId}, ${key}, ${userKey}, ${origin}, ${source},
      ${JSON.stringify(inputSnapshot)}::jsonb,
      ${seedMediaType}, ${seedTmdbId}, ${seedImdbId}, ${seedTitle},
      ${cacheVersion}, ${now}, ${now}, ${expiresAt}, false
    )
    ON CONFLICT (user_key)
    DO UPDATE SET
      input_snapshot = ${JSON.stringify(inputSnapshot)}::jsonb,
      seed_media_type = EXCLUDED.seed_media_type,
      seed_tmdb_id = EXCLUDED.seed_tmdb_id,
      seed_imdb_id = EXCLUDED.seed_imdb_id,
      seed_title = EXCLUDED.seed_title,
      cache_version = EXCLUDED.cache_version,
      updated_at = EXCLUDED.updated_at,
      expires_at = EXCLUDED.expires_at,
      is_stale = false
    RETURNING id;
  `)) as unknown as ExecResult;

  const rows = result.rows ?? [];
  const setId: string = rows[0]?.id ?? id;
  return { setId, userKey };
}

async function replaceRecommendationItems(setId: string, items: Rec[]) {
  const now = new Date();

  await db.execute(
    sql`DELETE FROM recommendation_items WHERE set_id = ${setId};`
  );

  for (let i = 0; i < items.length; i++) {
    const r = items[i];
    const tagsJson = JSON.stringify(Array.isArray(r.tags) ? r.tags : []);

    await db.execute(sql`
      INSERT INTO recommendation_items (
        id, set_id, rank, title, description, reason, tags, raw_json, created_at, updated_at
      )
      VALUES (
        ${randomUUID()},
        ${setId},
        ${i},
        ${r.title},
        ${r.description ?? null},
        ${r.reason ?? null},
        (
          SELECT COALESCE(array_agg(value::text), ARRAY[]::text[])
          FROM jsonb_array_elements_text(${tagsJson}::jsonb)
        ),
        ${JSON.stringify(r)}::jsonb,
        ${now},
        ${now}
      );
    `);
  }
}

/** ------------------------------------------------------------------ */
/** Main handler                                                        */
/** ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  await ensureTablesOnce;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return Response.json(
        { error: "Missing GOOGLE_GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const bodyUnknown: unknown = await req.json();
    const body = bodyUnknown as RecommendBody;

    const mode: "profile" | "seed" =
      isRecord(body) && body.mode === "seed" ? "seed" : "profile";

    const desired =
      isRecord(body) && typeof body.count === "number" && body.count > 0
        ? Math.min(12, Math.max(1, Math.floor(body.count)))
        : null;
    const targetCount = desired ?? (mode === "seed" ? 3 : 8);

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

    // ---- Common: watchlist to avoid ----
    const watchList: WatchListItem[] =
      isRecord(body) && Array.isArray(body.watchList) ? body.watchList : [];
    const watchListLines =
      watchList.length > 0
        ? watchList
            .map((w) => {
              if (typeof w === "string") return `- ${w}`;
              const title = typeof w.title === "string" ? w.title : "";
              const name = typeof w.name === "string" ? w.name : "";
              return `- ${title || name}`;
            })
            .join("\n")
        : "(none provided)";

    // ---------------------------- SEED MODE ----------------------------
    if (mode === "seed") {
      const seed: SeedInput | undefined = (body as SeedPayload).seed;
      if (!seed?.title) {
        return Response.json({ error: "Seed title missing" }, { status: 400 });
      }

      const forbidden = makeForbiddenSet([...(watchList as unknown[])]); // ok: guard inside
      forbidden.add(slugTitle(seed.title));

      const seedPrompt = `
You are a TV/film expert.

SEED TITLE:
- Title: ${seed.title}
- Type: ${seed.type ?? "unknown"}
- Year: ${seed.year ?? "?"}
- Genres: ${(seed.genres ?? []).join(", ") || "(unknown)"}
- Overview: ${brief(seed.overview) || "(none)"}

User watchlist (titles to avoid):
${watchListLines}

Task:
- Propose EXACTLY ${targetCount} titles strongly related to the SEED by theme, tone, audience, craft, or creators.
- Prefer recent titles (past ~5 years) but older titles are allowed if a new title isn't a strong fit.
- Avoid direct duplicates and avoid the SEED itself.
- Use web search check for the latest titles and reviews.
- Output ONE line per item, NO preamble/numbering/URLs.
- If you know it, include the release year in parentheses right after the title (e.g., "Dune (2021)").
- END output with: <<<END>>>

FORMAT:
Title (optional YYYY) | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

      const groundedRes: unknown = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL_GROUNDED || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: seedPrompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseModalities: ["TEXT"],
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 600,
          temperature: 0.6,
          stopSequences: ["<<<END>>>"],
          candidateCount: 1,
        },
      });

      const {
        text: seedText,
        finishReason,
        blockReason,
        partsCount,
      } = extractModelText(groundedRes);
      const endIdx = seedText.indexOf("<<<END>>>");
      const groundedAll = (
        endIdx >= 0 ? seedText.slice(0, endIdx) : seedText
      ).trim();

      if (!groundedAll) {
        // eslint-disable-next-line no-console
        console.error("GROUNDING DEBUG (seed):", {
          finishReason,
          blockReason,
          partsCount,
        });
        return Response.json(
          {
            error: "Seeded generation failed (empty response)",
            finishReason,
            blockReason,
          },
          { status: 502 }
        );
      }

      const filteredLines = uniqueAllowedLines(
        parseLines(groundedAll),
        forbidden
      );
      const kept = filteredLines.slice(0, targetCount);
      let attempts = 0;

      while (kept.length < targetCount && attempts < 3) {
        attempts++;
        const haveSlugs = new Set(
          kept.map((l) => slugTitle(l.split("|")[0].trim()))
        );
        const expandedForbidden = new Set<string>([...forbidden, ...haveSlugs]);

        const repairPrompt = `
We need ${targetCount - kept.length} additional titles similar to "${
          seed.title
        }".
Forbidden slugs (normalized):
${Array.from(expandedForbidden).join(", ")}

Rules:
- Prefer recent titles, but older ones allowed if they fit best.
- No duplicates (also not the seed).
- Output ONE line per item, same format.
- Include year in parentheses if you know it.
- END with <<<END>>>

FORMAT:
Title (optional YYYY) | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;
        const repairRes: unknown = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL_GROUNDED || "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
          config: {
            tools: [{ googleSearch: {} }],
            responseModalities: ["TEXT"],
            maxOutputTokens: 300,
            temperature: 0.7,
            stopSequences: ["<<<END>>>"],
            candidateCount: 1,
          },
        });

        const { text: repairRaw } = extractModelText(repairRes);
        const rendIdx = repairRaw.indexOf("<<<END>>>");
        const repairText = (
          rendIdx >= 0 ? repairRaw.slice(0, rendIdx) : repairRaw
        ).trim();

        const newLines = uniqueAllowedLines(
          parseLines(repairText),
          expandedForbidden
        );
        const keptSlugs = new Set(
          kept.map((l) => slugTitle(l.split("|")[0].trim()))
        );
        for (const nl of newLines) {
          const s = slugTitle(nl.split("|")[0].trim());
          if (!keptSlugs.has(s)) {
            kept.push(nl);
            keptSlugs.add(s);
            if (kept.length === targetCount) break;
          }
        }
      }

      const groundedText = kept.slice(0, targetCount).join("\n");
      let recommendations: Rec[] = await structureToJson(
        ai,
        groundedText,
        targetCount
      );

      // Final safety net: remove collisions, de-dupe, top-up if needed
      const finalSeen = new Set<string>();
      recommendations = recommendations.filter((r) => {
        const s = slugTitle(r.title);
        if (!s || forbidden.has(s) || finalSeen.has(s)) return false;
        finalSeen.add(s);
        return true;
      });

      if (recommendations.length < targetCount) {
        const needed = targetCount - recommendations.length;
        const strictTopUpRes: unknown = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
          contents: `
Suggest ${needed} titles as JSON ONLY, similar to "${seed.title}".
Prefer recent titles, but older ones are allowed if more relevant.
Forbidden slugs:
${Array.from(new Set<string>([...finalSeen, ...forbidden])).join(", ")}

Each item: { "title", "description", "reason", "tags": [strings], "year": number|null }.
- If year is known, set it; otherwise null. Do not guess.
- Concise. No duplicates. No forbidden items.
`,
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
            temperature: 0.4,
            maxOutputTokens: 400,
          },
        });

        const { text: topTxt } = extractModelText(strictTopUpRes);
        const top: Rec[] = parseJsonArrayOfRecs(topTxt || "[]");

        for (const r of top) {
          const s = slugTitle(r.title);
          if (!s || finalSeen.has(s) || forbidden.has(s)) continue;
          finalSeen.add(s);
          recommendations.push({
            title: r.title.trim(),
            description: (r.description ?? "").trim(),
            reason: (r.reason ?? "").trim(),
            tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t)) : [],
            year: typeof r.year === "number" ? Math.trunc(r.year) : null,
          });
          if (recommendations.length === targetCount) break;
        }
      }

      const key = buildRecKey({ mode, seed });
      const { setId } = await upsertRecommendationSet({
        userId: session.user.id as string,
        key,
        origin: "SEED",
        inputSnapshot: bodyUnknown,
        seedMediaType: seed.type ?? null,
        seedTmdbId: seed.external?.tmdbId ?? null,
        seedImdbId: seed.external?.imdbId ?? null,
        seedTitle: seed.title ?? null,
        cacheVersion: process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await replaceRecommendationItems(setId, recommendations);

      return Response.json({ recommendations, key, setId });
    }

    // ---------------------------- PROFILE MODE ----------------------------
    const titles: TitleInput[] =
      isRecord(body) && Array.isArray((body as ProfilePayload).titles)
        ? (body as ProfilePayload).titles
        : [];
    if (titles.length === 0) {
      return Response.json({ error: "No titles provided" }, { status: 400 });
    }

    const forbidden = makeForbiddenSet([
      ...(titles as unknown[]),
      ...(watchList as unknown[]),
    ]);

    const compact = titles.slice(0, 12).map((s) => ({
      title:
        typeof s.title === "string"
          ? s.title
          : typeof s.name === "string"
          ? s.name
          : String(s.title ?? s.name ?? ""),
      rating:
        typeof s.rating === "number"
          ? s.rating
          : typeof s.score === "number"
          ? s.score
          : typeof s.userRating === "number"
          ? s.userRating
          : null,
    }));

    const groundedPrompt = `
You are a TV/film expert.

User favorites (title::rating), one per line:
${compact.map((s) => `${s.title}::${s.rating ?? ""}`).join("\n")}

User watchlist (titles to avoid):
${watchListLines}

Task:
- Propose EXACTLY ${targetCount} titles that the user is likely to enjoy.
- Prefer recent titles (past ~5 years), but older titles are allowed if they are a better fit.
- DO NOT include titles that are already in the favorites list OR the watchlist.
- Use web search check for the latest titles and reviews.
- Output ONE line per item, NO preamble/numbering/URLs.
- If you know it, include the release year in parentheses right after the title (e.g., "Past Lives (2023)").
- END output with: <<<END>>>

FORMAT:
Title (optional YYYY) | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

    const groundedRes: unknown = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL_GROUNDED || "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: groundedPrompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseModalities: ["TEXT"],
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 600,
        temperature: 0.6,
        stopSequences: ["<<<END>>>"],
        candidateCount: 1,
      },
    });

    const {
      text: rawProfile,
      finishReason,
      blockReason,
      partsCount,
    } = extractModelText(groundedRes);
    const endIdx = rawProfile.indexOf("<<<END>>>");
    const groundedAll = (
      endIdx >= 0 ? rawProfile.slice(0, endIdx) : rawProfile
    ).trim();

    if (!groundedAll) {
      // eslint-disable-next-line no-console
      console.error("GROUNDING DEBUG (profile):", {
        finishReason,
        blockReason,
        partsCount,
      });
      return Response.json(
        {
          error: "Grounded generation failed (empty response)",
          finishReason,
          blockReason,
        },
        { status: 502 }
      );
    }

    const filteredLines = uniqueAllowedLines(
      parseLines(groundedAll),
      forbidden
    );

    const kept = filteredLines.slice(0, targetCount);
    let attempts = 0;

    while (kept.length < targetCount && attempts < 3) {
      attempts++;
      const haveSlugs = new Set(
        kept.map((l) => slugTitle(l.split("|")[0].trim()))
      );
      const expandedForbidden = new Set<string>([...forbidden, ...haveSlugs]);
      const repairPrompt = `
We need ${
        targetCount - kept.length
      } additional titles, not in the forbidden list.

Forbidden slugs (normalized):
${Array.from(expandedForbidden).join(", ")}

Rules:
- Prefer recent titles, but older ones are allowed if they fit best.
- No duplicates of each other or prior suggestions.
- Output ONE line per item, same format as before.
- Include year in parentheses if you know it.
- END with <<<END>>>

FORMAT:
Title (optional YYYY) | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

      const repairRes: unknown = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL_GROUNDED || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseModalities: ["TEXT"],
          maxOutputTokens: 300,
          temperature: 0.7,
          stopSequences: ["<<<END>>>"],
          candidateCount: 1,
        },
      });

      const { text: rraw } = extractModelText(repairRes);
      const rendIdx = rraw.indexOf("<<<END>>>");
      const repairText = (rendIdx >= 0 ? rraw.slice(0, rendIdx) : rraw).trim();

      const newLines = uniqueAllowedLines(
        parseLines(repairText),
        expandedForbidden
      );
      const keptSlugs = new Set(
        kept.map((l) => slugTitle(l.split("|")[0].trim()))
      );
      for (const nl of newLines) {
        const s = slugTitle(nl.split("|")[0].trim());
        if (!keptSlugs.has(s)) {
          kept.push(nl);
          keptSlugs.add(s);
          if (kept.length === targetCount) break;
        }
      }
    }

    const groundedText = kept.slice(0, targetCount).join("\n");
    let recommendations: Rec[] = await structureToJson(
      ai,
      groundedText,
      targetCount
    );

    const finalSeen = new Set<string>();
    recommendations = recommendations.filter((r) => {
      const s = slugTitle(r.title);
      if (!s || forbidden.has(s) || finalSeen.has(s)) return false;
      finalSeen.add(s);
      return true;
    });

    if (recommendations.length < targetCount) {
      const needed = targetCount - recommendations.length;
      const strictTopUpRes: unknown = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
        contents: `
Suggest ${needed} titles as JSON ONLY that are NOT in this forbidden list.
Prefer recent titles, but older ones are allowed if most relevant.

Forbidden slugs:
${Array.from(new Set<string>([...forbidden, ...finalSeen])).join(", ")}

Each item: { "title", "description", "reason", "tags": [strings], "year": number|null }.
- If year is known, set it; otherwise null. Do not guess.
- Concise. No duplicates. No forbidden items.
`,
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
          temperature: 0.4,
          maxOutputTokens: 400,
        },
      });

      const { text: topTxt } = extractModelText(strictTopUpRes);
      const top = parseJsonArrayOfRecs(topTxt || "[]");

      for (const r of top) {
        const s = slugTitle(r.title);
        if (!s || finalSeen.has(s) || forbidden.has(s)) continue;
        finalSeen.add(s);
        recommendations.push({
          title: r.title.trim(),
          description: (r.description ?? "").trim(),
          reason: (r.reason ?? "").trim(),
          tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t)) : [],
          year: typeof r.year === "number" ? Math.trunc(r.year) : null,
        });
        if (recommendations.length === targetCount) break;
      }
    }

    const key = buildRecKey({ mode });
    const { setId } = await upsertRecommendationSet({
      userId: session.user.id as string,
      key,
      origin: "PROFILE",
      inputSnapshot: bodyUnknown,
      cacheVersion: process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await replaceRecommendationItems(setId, recommendations);

    return Response.json({ recommendations, key, setId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Recommend route error:", err);
    return Response.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
