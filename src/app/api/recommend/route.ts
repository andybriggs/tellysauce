/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

type Rec = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
};

type SeedInput = {
  title: string;
  overview?: string;
  genres?: string[];
  year?: number;
  type?: "movie" | "tv";
  external?: { tmdbId?: number; imdbId?: string | null };
};

function buildRecKey(payload: any) {
  const mode: "profile" | "seed" =
    payload?.mode === "seed" ? "seed" : "profile";
  if (mode === "profile") {
    const v = process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3";
    return `profile:${v}`;
  }
  const t = payload?.seed?.type ?? "unknown";
  const tmdb = payload?.seed?.external?.tmdbId;
  if (tmdb) return `seed:${t}:${tmdb}`;
  const slug = slugTitle(String(payload?.seed?.title ?? ""));
  return `seed:${t}:${slug || "unknown"}`;
}

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

function slugTitle(raw: string) {
  if (!raw) return "";
  // remove year in parens or at end
  let s = raw.replace(/\(\s*\d{4}\s*\)/g, "").replace(/\b\d{4}\b/g, "");
  // cut subtitles after ":" or "-" if present (keeps main name)
  s = s.split(":")[0].split(" - ")[0];
  // normalize
  s = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ") // drop leading articles
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function makeForbiddenSet(input: any[]): Set<string> {
  const set = new Set<string>();
  for (const item of input ?? []) {
    const t =
      item?.title ?? item?.name ?? (typeof item === "string" ? item : "") ?? "";
    const slug = slugTitle(String(t));
    if (slug) set.add(slug);
    // also add a couple of relaxed variants to be safer
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

async function structureToJson(
  ai: GoogleGenAI,
  groundedText: string,
  targetCount: number
): Promise<Rec[]> {
  const structuringRes = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
    contents: `
Turn the following lines into STRICT JSON.

Rules:
- Output ONLY JSON (no prose, no code fences).
- Each item: { "title", "description", "reason", "tags": [strings] }.
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
          },
          required: ["title", "description", "reason", "tags"],
          additionalProperties: false,
        },
      },
      temperature: 0.2,
      maxOutputTokens: 700,
    },
  });

  const txt = (structuringRes as any)?.text ?? "[]";
  let parsed: any;
  try {
    parsed = JSON.parse(txt);
  } catch {
    parsed = [];
  }
  // sanitize fields minimally
  return (Array.isArray(parsed) ? parsed : [])
    .map((r) => ({
      title: String(r?.title ?? "").trim(),
      description: String(r?.description ?? "").trim(),
      reason: String(r?.reason ?? "").trim(),
      tags: Array.isArray(r?.tags) ? r.tags.map((t: any) => String(t)) : [],
    }))
    .filter((r) => r.title);
}

async function upsertRecommendationSet(params: {
  userId: string;
  key: string;
  origin: "PROFILE" | "SEED" | "CUSTOM_LIST";
  source?: string;
  inputSnapshot: any;
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

  const result = await db.execute(sql`
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
  `);

  const setId: string = (result as any).rows?.[0]?.id ?? id;
  return { setId, userKey };
}

async function replaceRecommendationItems(setId: string, items: Rec[]) {
  const now = new Date();

  // Remove any previous items for this set
  await db.execute(
    sql`DELETE FROM recommendation_items WHERE set_id = ${setId};`
  );

  // Insert new items
  for (let i = 0; i < items.length; i++) {
    const r = items[i];

    // Safely pass tags as JSON, convert to text[] in SQL
    const tagsJson = JSON.stringify(Array.isArray(r.tags) ? r.tags : []);

    await db.execute(sql`
      INSERT INTO recommendation_items (
        id, set_id, rank, title, description, reason, tags, raw_json, created_at, updated_at
      )
      VALUES (
        ${randomUUID()},         -- id
        ${setId},                -- set_id
        ${i},                    -- rank
        ${r.title},              -- title
        ${r.description ?? null},-- description
        ${r.reason ?? null},     -- reason
        (
          SELECT COALESCE(array_agg(value::text), ARRAY[]::text[])
          FROM jsonb_array_elements_text(${tagsJson}::jsonb)
        ),                       -- tags (text[])
        ${JSON.stringify(r)}::jsonb,  -- raw_json
        ${now},                  -- created_at
        ${now}                   -- updated_at
      );
    `);
  }
}

export async function POST(req: NextRequest) {
  await ensureTablesOnce; // make sure tables exist

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

    const body = await req.json();

    // Two modes:
    const mode: "profile" | "seed" = body?.mode === "seed" ? "seed" : "profile";

    // Target count (defaults: 3 for seed, 8 for profile). Clamp 1..12.
    const targetCount =
      typeof body?.count === "number" && body.count > 0
        ? Math.min(12, Math.max(1, Math.floor(body.count)))
        : mode === "seed"
        ? 3
        : 8;

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

    // ---- Common: watchlist to avoid ----
    const watchList = Array.isArray(body?.watchList) ? body.watchList : [];
    const watchListLines =
      Array.isArray(watchList) && watchList.length > 0
        ? watchList.map((w: any) => `- ${w?.title ?? w?.name ?? w}`).join("\n")
        : "(none provided)";

    // ---------------------------- SEED MODE ----------------------------
    if (mode === "seed") {
      const seed: SeedInput | undefined = body?.seed;
      if (!seed?.title) {
        return Response.json({ error: "Seed title missing" }, { status: 400 });
      }

      // Build forbidden set from watchlist + the seed itself
      const forbidden = makeForbiddenSet([...(watchList ?? [])]);
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
- Propose EXACTLY ${targetCount} *new* titles strongly related to the SEED by theme, tone, audience, craft, or creators.
- Avoid the same cinematic universe direct duplicates and avoid the SEED itself.
- Consider recency and critical reception (use web search).
- Output ONE line per item, NO preamble/numbering/URLs.
- END output with: <<<END>>>

FORMAT:
Title | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

      const groundedRes = await ai.models.generateContent({
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

      const parts = (groundedRes as any)?.candidates?.[0]?.content?.parts ?? [];
      const raw = parts
        .map((p: any) => (typeof p.text === "string" ? p.text : ""))
        .join("")
        .trim();
      const endIdx = raw.indexOf("<<<END>>>");
      const groundedAll = (endIdx >= 0 ? raw.slice(0, endIdx) : raw).trim();

      if (!groundedAll) {
        const finish =
          (groundedRes as any)?.candidates?.[0]?.finishReason ?? null;
        const block = (groundedRes as any)?.promptFeedback?.blockReason ?? null;
        console.error("GROUNDING DEBUG (seed):", {
          finishReason: finish,
          blockReason: block,
          partsCount: parts.length,
        });
        return Response.json(
          {
            error: "Seeded generation failed (empty response)",
            finishReason: finish,
            blockReason: block,
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
        const expandedForbidden = new Set([...forbidden, ...haveSlugs]);

        const repairPrompt = `
We need ${targetCount - kept.length} NEW titles similar to "${seed.title}".
Forbidden slugs (normalized):
${Array.from(expandedForbidden).join(", ")}

Rules:
- No duplicates (also not the seed).
- Output ONE line per item, same format.
- END with <<<END>>>

FORMAT:
Title | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;
        const repairRes = await ai.models.generateContent({
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

        const rparts =
          (repairRes as any)?.candidates?.[0]?.content?.parts ?? [];
        const rraw = rparts
          .map((p: any) => p.text ?? "")
          .join("")
          .trim();
        const rendIdx = rraw.indexOf("<<<END>>>");
        const repairText = (
          rendIdx >= 0 ? rraw.slice(0, rendIdx) : rraw
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
        const strictTopUp = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
          contents: `
Suggest ${needed} NEW titles as JSON ONLY, similar to "${seed.title}".
Forbidden slugs:
${Array.from(new Set([...forbidden, ...finalSeen])).join(", ")}

Each item: { "title", "description", "reason", "tags": [strings] }.
Concise. No duplicates. No forbidden items.
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
                },
                required: ["title", "description", "reason", "tags"],
                additionalProperties: false,
              },
            },
            temperature: 0.4,
            maxOutputTokens: 400,
          },
        });

        const topTxt = (strictTopUp as any)?.text ?? "[]";
        let top: Rec[] = [];
        try {
          top = JSON.parse(topTxt);
        } catch {
          top = [];
        }

        for (const r of top) {
          const s = slugTitle(r.title);
          if (!s || finalSeen.has(s) || forbidden.has(s)) continue;
          finalSeen.add(s);
          recommendations.push({
            title: String(r.title).trim(),
            description: String(r.description ?? "").trim(),
            reason: String(r.reason ?? "").trim(),
            tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
          });
          if (recommendations.length === targetCount) break;
        }
      }

      // ---------- persist ----------
      const key = buildRecKey({ mode, seed });
      const { setId } = await upsertRecommendationSet({
        userId: session.user.id as string,
        key,
        origin: "SEED",
        inputSnapshot: body,
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
    const titles = Array.isArray(body?.titles) ? body.titles : [];
    if (!Array.isArray(titles) || titles.length === 0) {
      return Response.json({ error: "No titles provided" }, { status: 400 });
    }

    // Build forbidden set from ALL favorites + ALL watchlist
    const forbidden = makeForbiddenSet([
      ...(titles ?? []),
      ...(watchList ?? []),
    ]);

    // Keep the compact list (only for preference weighting)
    const compact = titles.slice(0, 12).map((s: any) => ({
      title: s?.title ?? s?.name ?? String(s),
      rating: s?.rating ?? s?.score ?? s?.userRating ?? null,
    }));

    const groundedPrompt = `
You are a TV/film expert.

User favorites (title::rating), one per line:
${compact.map((s: any) => `${s.title}::${s.rating ?? ""}`).join("\n")}

User watchlist (titles to avoid):
${watchListLines}

Task:
- Propose EXACTLY ${targetCount} new titles.
- DO NOT include titles that are already in the users favourite titles list OR watchlist.
- Weight toward higher-rated favorites.
- Use web search to check for latest titles and reviews.
- Output ONE line per item, NO preamble/numbering/URLs.
- END output with: <<<END>>>

FORMAT:
Title | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

    const groundedRes = await ai.models.generateContent({
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

    const parts = (groundedRes as any)?.candidates?.[0]?.content?.parts ?? [];
    const raw = parts
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
    const endIdx = raw.indexOf("<<<END>>>");
    const groundedAll = (endIdx >= 0 ? raw.slice(0, endIdx) : raw).trim();

    if (!groundedAll) {
      const finish =
        (groundedRes as any)?.candidates?.[0]?.finishReason ?? null;
      const block = (groundedRes as any)?.promptFeedback?.blockReason ?? null;
      console.error("GROUNDING DEBUG (profile):", {
        finishReason: finish,
        blockReason: block,
        partsCount: parts.length,
      });
      return Response.json(
        {
          error: "Grounded generation failed (empty response)",
          finishReason: finish,
          blockReason: block,
        },
        { status: 502 }
      );
    }

    // Filter lines against forbidden + de-dupe
    const filteredLines = uniqueAllowedLines(
      parseLines(groundedAll),
      forbidden
    );

    // If not enough lines survive, attempt up to 3 quick “repair” passes
    const kept = filteredLines.slice(0, targetCount);
    let attempts = 0;

    while (kept.length < targetCount && attempts < 3) {
      attempts++;
      const haveSlugs = new Set(
        kept.map((l) => slugTitle(l.split("|")[0].trim()))
      );
      const expandedForbidden = new Set([...forbidden, ...haveSlugs]);
      const repairPrompt = `
You previously proposed some titles. I need NEW ones that are not in this forbidden list.

Forbidden slugs (normalized):
${Array.from(expandedForbidden).join(", ")}

Task:
- Propose ${targetCount - kept.length} ADDITIONAL titles only.
- No duplicates of each other or of prior suggestions.
- Output ONE line per item, same format as before.
- END with <<<END>>>

FORMAT:
Title | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

      const repairRes = await ai.models.generateContent({
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

      const rparts = (repairRes as any)?.candidates?.[0]?.content?.parts ?? [];
      const rraw = rparts
        .map((p: any) => p.text ?? "")
        .join("")
        .trim();
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

    // Final safety net: remove collisions, de-dupe, and top up via another repair if needed
    const finalSeen = new Set<string>();
    recommendations = recommendations.filter((r) => {
      const s = slugTitle(r.title);
      if (!s || forbidden.has(s) || finalSeen.has(s)) return false;
      finalSeen.add(s);
      return true;
    });

    if (recommendations.length < targetCount) {
      const needed = targetCount - recommendations.length;
      const strictTopUp = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
        contents: `
Suggest ${needed} NEW titles as JSON ONLY that are NOT in this forbidden list.

Forbidden slugs:
${Array.from(new Set([...forbidden, ...finalSeen])).join(", ")}

Each item: { "title", "description", "reason", "tags": [strings] }.
Keep it concise. No duplicates. No forbidden items.
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
              },
              required: ["title", "description", "reason", "tags"],
              additionalProperties: false,
            },
          },
          temperature: 0.4,
          maxOutputTokens: 400,
        },
      });

      const topTxt = (strictTopUp as any)?.text ?? "[]";
      let top: Rec[] = [];
      try {
        top = JSON.parse(topTxt);
      } catch {
        top = [];
      }

      for (const r of top) {
        const s = slugTitle(r.title);
        if (!s || finalSeen.has(s) || forbidden.has(s)) continue;
        finalSeen.add(s);
        recommendations.push({
          title: String(r.title).trim(),
          description: String(r.description ?? "").trim(),
          reason: String(r.reason ?? "").trim(),
          tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        });
        if (recommendations.length === targetCount) break;
      }
    }

    // ---------- persist ----------
    const key = buildRecKey({ mode });
    const { setId } = await upsertRecommendationSet({
      userId: session.user.id as string,
      key,
      origin: "PROFILE",
      inputSnapshot: body,
      cacheVersion: process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await replaceRecommendationItems(setId, recommendations);

    return Response.json({ recommendations, key, setId });
  } catch (err) {
    console.error("Recommend route error:", err);
    return Response.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
