import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { buildRecKey, slugTitle } from "@/lib/recs";
import { SeedInput } from "@/types";
import {
  callOpenAI,
  validateAndEnrich,
  upsertRecommendationSet,
  replaceRecommendationItems,
} from "@/server/recommendations";

export { type Rec } from "@/server/recommendations";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ------------------------------------------------------------------ */
/** Types                                                              */
/** ------------------------------------------------------------------ */

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

function brief(str?: string | null, max = 240) {
  if (!str) return "";
  const s = String(str).trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
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
