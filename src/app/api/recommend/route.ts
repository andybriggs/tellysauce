import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { buildRecKey } from "@/lib/recs";
import { SeedInput } from "@/types";
import { openai } from "@/lib/ai";
import { searchTmdbByTitle, tmdbImg } from "@/server/tmdb";

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
  mediaType: "movie" | "tv";
  // Populated after TMDB validation
  resolvedTmdbId?: number | null;
  poster?: string | null;
};

type TitleInput = {
  title?: string;
  name?: string;
  type?: string;
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

// Minimal shape of a db.execute result we rely on
type ExecResult = { rows?: Array<{ id?: string }> };
type UserSubRow = {
  subscription_status: string | null;
  free_rec_calls_used: number;
  pro_rec_calls_this_period: number;
};

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
/** Utilities                                                           */
/** ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
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

function brief(str?: string | null, max = 240) {
  if (!str) return "";
  const s = String(str).trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** ------------------------------------------------------------------ */
/** OpenAI structured call                                              */
/** ------------------------------------------------------------------ */

async function callOpenAI(prompt: string): Promise<Rec[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "recommendations",
        strict: true,
        schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  reason: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  year: { anyOf: [{ type: "integer" }, { type: "null" }] },
                  mediaType: { enum: ["movie", "tv"] },
                },
                required: ["title", "description", "reason", "tags", "year", "mediaType"],
                additionalProperties: false,
              },
            },
          },
          required: ["recommendations"],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
    max_tokens: 1600,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { recommendations?: unknown[] };
  return (parsed.recommendations ?? []).filter(
    (r): r is Rec =>
      isRecord(r) &&
      typeof (r as Rec).title === "string" &&
      (r as Rec).title.length > 0 &&
      ((r as Rec).mediaType === "movie" || (r as Rec).mediaType === "tv")
  );
}

async function fetchAndResolveTmdb(
  title: string,
  mediaType: "movie" | "tv",
  year?: number | null
): Promise<{ resolvedTmdbId: number; poster: string | null; year: number | null; description: string | null } | null> {
  const hit = await searchTmdbByTitle(title, mediaType, year);
  if (!hit) return null;
  return {
    resolvedTmdbId: hit.id,
    poster: tmdbImg.posterMedium(hit.posterPath),
    year: hit.year,
    description: hit.overview,
  };
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
    source = "OPENAI",
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
        id, set_id, rank, title, description, reason, tags,
        suggested_media_type, suggested_tmdb_id,
        raw_json, created_at, updated_at
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
        ${r.mediaType ?? null},
        ${r.resolvedTmdbId ?? null},
        ${JSON.stringify(r)}::jsonb,
        ${now},
        ${now}
      );
    `);
  }
}

/** Upserts a resolved title into the shared titles cache table. */
async function upsertTitle(r: {
  resolvedTmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster: string | null;
  year: number | null;
  description: string | null;
}) {
  await db.execute(sql`
    INSERT INTO titles (id, tmdb_id, media_type, title, poster, year, description, created_at, updated_at)
    VALUES (${randomUUID()}, ${r.resolvedTmdbId}, ${r.mediaType}, ${r.title}, ${r.poster}, ${r.year}, ${r.description}, now(), now())
    ON CONFLICT (tmdb_id, media_type) DO UPDATE SET
      poster      = EXCLUDED.poster,
      description = EXCLUDED.description,
      updated_at  = now()
  `);
}

/** Validates each rec against TMDB (parallel), upserts into titles, returns verified recs. */
async function validateAndEnrich(recs: Rec[]): Promise<Rec[]> {
  const results = await Promise.all(
    recs.map(async (r) => {
      const tmdb = await fetchAndResolveTmdb(r.title, r.mediaType, r.year);
      if (!tmdb) return null;
      // Enrich with TMDB ID and poster; prefer OpenAI year, fall back to TMDB year
      const enriched: Rec = {
        ...r,
        resolvedTmdbId: tmdb.resolvedTmdbId,
        poster: tmdb.poster,
        year: r.year ?? tmdb.year,
      };
      await upsertTitle({
        resolvedTmdbId: tmdb.resolvedTmdbId,
        mediaType: r.mediaType,
        title: r.title,
        poster: tmdb.poster,
        year: tmdb.year,
        description: r.description,
      });
      return enriched;
    })
  );
  return results.filter((r): r is Rec => r !== null);
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

  const userId = session.user.id as string;

  try {
    // Subscription gate: check free call allowance
    const subResult = await db.execute(
      sql`SELECT subscription_status, free_rec_calls_used, pro_rec_calls_this_period FROM users WHERE id = ${userId}`
    );
    const userRow = (
      (subResult as unknown as { rows?: UserSubRow[] }).rows ?? []
    )[0];
    const isSubscribed = userRow?.subscription_status === "active";
    const freeCallsUsed = userRow?.free_rec_calls_used ?? 0;
    const proCallsThisPeriod = userRow?.pro_rec_calls_this_period ?? 0;

    if (!isSubscribed && freeCallsUsed >= 3) {
      return Response.json(
        { error: "subscription_required", freeCallsUsed },
        { status: 402 }
      );
    }

    if (isSubscribed && proCallsThisPeriod >= 100) {
      return Response.json(
        { error: "monthly_limit_reached" },
        { status: 402 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY" },
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

    // ---- Common: watchlist to avoid ----
    const watchList: WatchListItem[] =
      isRecord(body) && Array.isArray(body.watchList) ? body.watchList : [];
    const watchlistTitles = watchList
      .map((w) => (typeof w === "string" ? w : (w.title || w.name || "")))
      .filter(Boolean);

    // ---------------------------- SEED MODE ----------------------------
    if (mode === "seed") {
      const seed: SeedInput | undefined = (body as SeedPayload).seed;
      if (!seed?.title) {
        return Response.json({ error: "Seed title missing" }, { status: 400 });
      }

      const avoidLines = [...watchlistTitles, seed.title]
        .filter(Boolean)
        .map((t) => `- ${t}`)
        .join("\n") || "- (none)";

      const formatPreference = seed.type === "tv" ? "TV series" : seed.type === "movie" ? "films" : "titles";

      const prompt = `You are a TV and film expert.

SEED TITLE:
- Title: ${seed.title}
- Type: ${seed.type ?? "unknown"}
- Year: ${seed.year ?? "unknown"}
- Genres: ${(seed.genres ?? []).join(", ") || "unknown"}
- Overview: ${brief(seed.overview) || "none"}

TITLES TO EXCLUDE - the user has already seen or saved all of these. Do not suggest any of them under any circumstances:
${avoidLines}

Return EXACTLY ${targetCount} titles that share the STRONGEST match with the seed across:
- Tone and emotional register (most important)
- Themes and subject matter
- Narrative structure or storytelling craft
- Target audience and viewing experience

Prefer ${formatPreference} to match the seed format, unless a cross-format title is an exceptional match.
If the seed is acclaimed for a specific quality (e.g. dark humour, unreliable narrator, slow burn tension), bias toward titles with that same quality.
Prefer titles from the past 5 years but include older classics if they are a strong match.
For each title provide: description (max 15 words), reason it matches the seed (max 10 words), 3-5 genre/style tags, release year (or null), and mediaType ("movie" or "tv").
Double-check your response against the exclusion list before returning it.`;

      const recommendations = await callOpenAI(prompt);

      // Light post-filter: remove any that collide with seed or watchlist
      const forbiddenSlugs = new Set([seed.title, ...watchlistTitles].map(slugTitle));
      const filtered = recommendations.filter(
        (r) => r.title && !forbiddenSlugs.has(slugTitle(r.title))
      );
      // Validate against TMDB, enrich with poster, filter out unresolvable titles
      const verified = await validateAndEnrich(filtered);

      const key = buildRecKey({ mode, seed });
      const { setId } = await upsertRecommendationSet({
        userId,
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
      await replaceRecommendationItems(setId, verified);

      if (isSubscribed) {
        await db.execute(
          sql`UPDATE users SET pro_rec_calls_this_period = pro_rec_calls_this_period + 1 WHERE id = ${userId}`
        );
      } else {
        await db.execute(
          sql`UPDATE users SET free_rec_calls_used = free_rec_calls_used + 1 WHERE id = ${userId}`
        );
      }

      return Response.json({ recommendations: verified, key, setId });
    }

    // ---------------------------- PROFILE MODE ----------------------------
    const titles: TitleInput[] =
      isRecord(body) && Array.isArray((body as ProfilePayload).titles)
        ? (body as ProfilePayload).titles
        : [];
    if (titles.length === 0) {
      return Response.json({ error: "No titles provided" }, { status: 400 });
    }

    const compact = titles.slice(0, 12).map((s) => ({
      title:
        typeof s.title === "string"
          ? s.title
          : typeof s.name === "string"
            ? s.name
            : String(s.title ?? s.name ?? ""),
      type: typeof s.type === "string" ? s.type : null,
      rating:
        typeof s.rating === "number"
          ? s.rating
          : typeof s.score === "number"
            ? s.score
            : typeof s.userRating === "number"
              ? s.userRating
              : null,
    }));

    const favoriteTitles = compact.map((s) => s.title);
    const avoidLines = [...favoriteTitles, ...watchlistTitles]
      .filter(Boolean)
      .map((t) => `- ${t}`)
      .join("\n") || "- (none)";

    // Group by rating tier for stronger signal
    const byTier = (star: number) =>
      compact
        .filter((s) => s.rating != null && Math.round(s.rating) === star)
        .map((s) => `- ${s.title}${s.type ? ` (${s.type === "tv" ? "TV" : "Film"})` : ""}`)
        .join("\n");

    const unrated = compact
      .filter((s) => s.rating == null)
      .map((s) => `- ${s.title}${s.type ? ` (${s.type === "tv" ? "TV" : "Film"})` : ""}`)
      .join("\n");

    // Compute dominant media type from top-rated titles (4★+)
    const topRated = compact.filter((s) => s.rating != null && s.rating >= 4);
    const tvCount = topRated.filter((s) => s.type === "tv").length;
    const movieCount = topRated.filter((s) => s.type === "movie").length;
    const dominant =
      tvCount > movieCount ? "TV shows" : movieCount > tvCount ? "films" : "mixed (TV and film equally)";

    const tierLines = [
      byTier(5) ? `★★★★★ (5/5):\n${byTier(5)}` : null,
      byTier(4) ? `★★★★☆ (4/5):\n${byTier(4)}` : null,
      byTier(3) ? `★★★☆☆ (3/5):\n${byTier(3)}` : null,
      byTier(2) ? `★★☆☆☆ (2/5):\n${byTier(2)}` : null,
      byTier(1) ? `★☆☆☆☆ (1/5):\n${byTier(1)}` : null,
      unrated ? `Unrated:\n${unrated}` : null,
    ].filter(Boolean).join("\n\n");

    const prompt = `You are a TV and film expert.

User's rated titles - higher rating = stronger preference signal:

${tierLines}

User's dominant preference: ${dominant}.

TITLES TO EXCLUDE - the user has already seen or saved all of these. Do not suggest any of them under any circumstances:
${avoidLines}

Return EXACTLY ${targetCount} titles the user is likely to rate 4 or 5 stars.
Weight your choices heavily toward the 5-star and 4-star titles as taste signals.
Mirror the dominant media type (${dominant}) unless a cross-type title is an exceptional match.
Focus on taste alignment, not general popularity.
Prefer titles from the past 5 years but include older titles if they are a strong match.
For each title provide: description (max 15 words), reason it suits this user (max 10 words), 3-5 genre/style tags, release year (or null), and mediaType ("movie" or "tv").
Double-check your response against the exclusion list before returning it.`;

    const recommendations = await callOpenAI(prompt);

    // Light post-filter: remove any that collide with favorites or watchlist
    const forbiddenSlugs = new Set([...favoriteTitles, ...watchlistTitles].map(slugTitle));
    const filtered = recommendations.filter(
      (r) => r.title && !forbiddenSlugs.has(slugTitle(r.title))
    );
    // Validate against TMDB, enrich with poster, filter out unresolvable titles
    const verified = await validateAndEnrich(filtered);

    const key = buildRecKey({ mode });
    const { setId } = await upsertRecommendationSet({
      userId,
      key,
      origin: "PROFILE",
      inputSnapshot: bodyUnknown,
      cacheVersion: process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await replaceRecommendationItems(setId, verified);

    if (isSubscribed) {
      await db.execute(
        sql`UPDATE users SET pro_rec_calls_this_period = pro_rec_calls_this_period + 1 WHERE id = ${userId}`
      );
    } else {
      await db.execute(
        sql`UPDATE users SET free_rec_calls_used = free_rec_calls_used + 1 WHERE id = ${userId}`
      );
    }

    return Response.json({ recommendations: verified, key, setId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Recommend route error:", err);
    return Response.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
