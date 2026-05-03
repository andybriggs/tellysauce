import { db } from "@/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { openai } from "@/lib/ai";
import { searchTmdbByTitle, tmdbImg } from "@/server/tmdb";

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

// Minimal shape of a db.execute result we rely on
type ExecResult = { rows?: Array<{ id?: string }> };

/** ------------------------------------------------------------------ */
/** Internal helpers                                                    */
/** ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** ------------------------------------------------------------------ */
/** OpenAI structured call                                              */
/** ------------------------------------------------------------------ */

export async function callOpenAI(prompt: string): Promise<Rec[]> {
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

/** ------------------------------------------------------------------ */
/** TMDB resolution                                                     */
/** ------------------------------------------------------------------ */

export async function fetchAndResolveTmdb(
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

export async function upsertRecommendationSet(params: {
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

export async function replaceRecommendationItems(setId: string, items: Rec[]) {
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
export async function upsertTitle(r: {
  resolvedTmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster: string | null;
  year: number | null;
  description: string | null;
}) {
  await db.execute(sql`
    INSERT INTO titles (id, tmdb_id, media_type, title, poster, year, description, genres, created_at, updated_at)
    VALUES (${randomUUID()}, ${r.resolvedTmdbId}, ${r.mediaType}, ${r.title}, ${r.poster}, ${r.year}, ${r.description}, NULL, now(), now())
    ON CONFLICT (tmdb_id, media_type) DO UPDATE SET
      poster      = EXCLUDED.poster,
      description = EXCLUDED.description,
      genres      = COALESCE(titles.genres, EXCLUDED.genres),
      updated_at  = now()
  `);
}

/** Validates each rec against TMDB (parallel), upserts into titles, returns verified recs. */
export async function validateAndEnrich(recs: Rec[]): Promise<Rec[]> {
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
