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
  type Rec,
} from "@/server/recommendations";
import { getRated, getWatchlist } from "@/server/titleStore";

import { awardBadges } from "@/server/badges";
import { regionLabel } from "@/lib/region";

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
  region?: string;
};

type SeedPayload = {
  mode: "seed";
  seed: SeedInput;
  watchList?: WatchListItem[];
  count?: number;
  region?: string;
};

type RecommendBody = ProfilePayload | SeedPayload;

type UserSubRow = {
  subscription_status: string | null;
  free_rec_calls_used: number;
  pro_rec_calls_this_period: number;
};


/** ------------------------------------------------------------------ */
/** Utilities                                                           */
/** ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Extra recs requested beyond the target, to absorb post-filter drops. */
const EXTRA_RECS = 4;
/** Prompt caps per rating tier - generous, but bounded for a huge history. */
const MAX_LOVED = 60;
const MAX_OKAY = 15;
const MAX_DISLIKED = 20;

/**
 * Every title the user has rated or saved, as display names (for the prompt)
 * and `${mediaType}:${tmdbId}` keys (for an exact post-filter). Matching on
 * TMDB id catches what title slugs miss, e.g. "The Office (US)" vs "The Office".
 * A DB failure degrades to no exclusions rather than failing the request.
 */
async function loadExclusions(
  userId: string
): Promise<{ names: string[]; ids: Set<string> }> {
  try {
    const [rated, watchlist] = await Promise.all([
      getRated(userId),
      getWatchlist(userId),
    ]);
    const all = [...rated, ...watchlist];
    return {
      names: all.map((t) => t.name).filter((n): n is string => !!n),
      ids: new Set(all.map((t) => `${t.type}:${t.id}`)),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[recommend] failed to load exclusions:", err);
    return { names: [], ids: new Set() };
  }
}

function brief(str?: string | null, max = 240) {
  if (!str) return "";
  const s = String(str).trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** ------------------------------------------------------------------ */
/** Main handler                                                        */
/** ------------------------------------------------------------------ */

/**
 * Records a successful generation against the caller's allowance and returns any
 * badges this call unlocked. lifetime_rec_calls is tracked separately because
 * free_rec_calls_used caps at 3 and pro_rec_calls_this_period resets each cycle.
 */
async function recordRecCall(
  userId: string,
  isSubscribed: boolean
): Promise<string[]> {
  if (isSubscribed) {
    await db.execute(
      sql`UPDATE users SET pro_rec_calls_this_period = pro_rec_calls_this_period + 1, lifetime_rec_calls = lifetime_rec_calls + 1 WHERE id = ${userId}`
    );
  } else {
    await db.execute(
      sql`UPDATE users SET free_rec_calls_used = free_rec_calls_used + 1, lifetime_rec_calls = lifetime_rec_calls + 1 WHERE id = ${userId}`
    );
  }

  return awardBadges(userId, "recs");
}

export async function POST(req: NextRequest) {
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

    // Anchoring the prompt to today's date matters: without it the model falls
    // back on its training distribution and "recent" silently means
    // "recent as of training", which is years out of date.
    const today = new Date().toISOString().slice(0, 10);
    const region =
      isRecord(body) && typeof body.region === "string" && body.region
        ? body.region.toUpperCase()
        : "GB";
    const regionName = regionLabel(region);

    // ---- Common: everything the user has already rated or saved ----
    // Loaded from the DB rather than trusted from the body, so the exclusion
    // covers the user's whole history - not just the titles sent as taste signal.
    const watchList: WatchListItem[] =
      isRecord(body) && Array.isArray(body.watchList) ? body.watchList : [];
    const bodyWatchlistTitles = watchList
      .map((w) => (typeof w === "string" ? w : (w.title || w.name || "")))
      .filter(Boolean);
    const exclusions = await loadExclusions(userId);
    const watchlistTitles = [...exclusions.names, ...bodyWatchlistTitles];

    // Ask for a few extra: some will be dropped as already-seen or unresolvable
    // on TMDB, and the carousel should still be full.
    const requestCount = targetCount + EXTRA_RECS;
    const finalise = (recs: Rec[]) =>
      recs
        .filter((r) => !exclusions.ids.has(`${r.mediaType}:${r.resolvedTmdbId}`))
        .slice(0, targetCount);

    // ---------------------------- SEED MODE ----------------------------
    if (mode === "seed") {
      const seed: SeedInput | undefined = (body as SeedPayload).seed;
      if (!seed?.title) {
        return Response.json({ error: "Seed title missing" }, { status: 400 });
      }

      const avoidLines = [...new Set([...watchlistTitles, seed.title].filter(Boolean))]
        .map((t) => `- ${t}`)
        .join("\n") || "- (none)";

      const formatPreference = seed.type === "tv" ? "TV series" : seed.type === "movie" ? "films" : "titles";

      const prompt = `You are a TV and film expert. Today's date is ${today}. The user watches in ${regionName}.

SEED TITLE:
- Title: ${seed.title}
- Type: ${seed.type ?? "unknown"}
- Year: ${seed.year ?? "unknown"}
- Genres: ${(seed.genres ?? []).join(", ") || "unknown"}
- Overview: ${brief(seed.overview) || "none"}

TITLES TO EXCLUDE - the user has already seen or saved all of these. Do not suggest any of them under any circumstances:
${avoidLines}

Return EXACTLY ${requestCount} titles that share the STRONGEST match with the seed across:
- Tone and emotional register (most important)
- Themes and subject matter
- Narrative structure or storytelling craft
- Target audience and viewing experience

Prefer ${formatPreference} to match the seed format, unless a cross-format title is an exceptional match.
If the seed is acclaimed for a specific quality (e.g. dark humour, unreliable narrator, slow burn tension), bias toward titles with that same quality.
Prefer titles released or airing new seasons since ${Number(today.slice(0, 4)) - 5}, but include older classics if they are a strong match. Recent releases from the last two years are especially welcome — do not restrict yourself to titles you have long known about.
Favour titles available to watch in ${regionName}, including local productions from that market.
For each title provide: description (max 15 words), reason it matches the seed (max 10 words), 3-5 genre/style tags, release year (or null), and mediaType ("movie" or "tv").
Double-check your response against the exclusion list before returning it.`;

      const recommendations = await callOpenAI(prompt);

      // Light post-filter: remove any that collide with seed or watchlist
      const forbiddenSlugs = new Set([seed.title, ...watchlistTitles].map(slugTitle));
      const filtered = recommendations.filter(
        (r) => r.title && !forbiddenSlugs.has(slugTitle(r.title))
      );
      // Validate against TMDB, enrich with poster, filter out unresolvable titles,
      // then drop anything whose TMDB id the user has already rated or saved
      const verified = finalise(await validateAndEnrich(filtered));

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

      const unlockedBadges = await recordRecCall(userId, isSubscribed);

      return Response.json({
        recommendations: verified,
        key,
        setId,
        unlockedBadges,
      });
    }

    // ---------------------------- PROFILE MODE ----------------------------
    const titles: TitleInput[] =
      isRecord(body) && Array.isArray((body as ProfilePayload).titles)
        ? (body as ProfilePayload).titles
        : [];
    if (titles.length === 0) {
      return Response.json({ error: "No titles provided" }, { status: 400 });
    }

    const compact = titles.map((s) => ({
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
    const avoidLines = [...new Set([...favoriteTitles, ...watchlistTitles].filter(Boolean))]
      .map((t) => `- ${t}`)
      .join("\n") || "- (none)";

    // Taste signal. Every 4-5 star title is sent (strongest first), because the
    // body arrives sorted by rated date and a fixed cut would drop favourites in
    // favour of whatever was rated last. 1-2 stars go in as explicit dislikes.
    const line = (s: (typeof compact)[number]) =>
      `- ${s.title}${s.type ? ` (${s.type === "tv" ? "TV" : "Film"})` : ""}`;
    const tier = (min: number, max: number, cap: number) =>
      compact
        .filter((s) => s.rating != null && s.rating >= min && s.rating <= max)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, cap);

    const loved = tier(4, 5, MAX_LOVED);
    const okay = tier(3, 3, MAX_OKAY);
    const disliked = tier(1, 2, MAX_DISLIKED);

    // Compute dominant media type from top-rated titles (4★+)
    const tvCount = loved.filter((s) => s.type === "tv").length;
    const movieCount = loved.filter((s) => s.type === "movie").length;
    const dominant =
      tvCount > movieCount ? "TV shows" : movieCount > tvCount ? "films" : "mixed (TV and film equally)";

    const tierLines = [
      loved.length
        ? `LOVED (rated 4-5 stars, strongest first) - the main taste signal:\n${loved.map((s) => `${line(s)} - ${s.rating}★`).join("\n")}`
        : null,
      okay.length ? `OK (rated 3 stars) - weak signal:\n${okay.map(line).join("\n")}` : null,
      disliked.length
        ? `DISLIKED (rated 1-2 stars) - steer away from titles like these:\n${disliked.map(line).join("\n")}`
        : null,
    ].filter(Boolean).join("\n\n");

    const prompt = `You are a TV and film expert. Today's date is ${today}. The user watches in ${regionName}.

User's ratings:

${tierLines}

User's dominant preference: ${dominant}.

TITLES TO EXCLUDE - the user has already seen or saved all of these. Do not suggest any of them under any circumstances:
${avoidLines}

Return EXACTLY ${requestCount} titles the user is likely to rate 4 or 5 stars.
Base your choices on the LOVED titles. Avoid the tone, themes and styles of the DISLIKED titles.
Mirror the dominant media type (${dominant}) unless a cross-type title is an exceptional match.
Focus on taste alignment, not general popularity.
Prefer titles released or airing new seasons since ${Number(today.slice(0, 4)) - 5}, but include older titles if they are a strong match. Recent releases from the last two years are especially welcome — do not restrict yourself to titles you have long known about.
Favour titles available to watch in ${regionName}, including local productions from that market.
For each title provide: description (max 15 words), reason it suits this user (max 10 words), 3-5 genre/style tags, release year (or null), and mediaType ("movie" or "tv").
Double-check your response against the exclusion list before returning it.`;

    const recommendations = await callOpenAI(prompt);

    // Light post-filter: remove any that collide with favorites or watchlist
    const forbiddenSlugs = new Set([...favoriteTitles, ...watchlistTitles].map(slugTitle));
    const filtered = recommendations.filter(
      (r) => r.title && !forbiddenSlugs.has(slugTitle(r.title))
    );
    // Validate against TMDB, enrich with poster, filter out unresolvable titles,
    // then drop anything whose TMDB id the user has already rated or saved
    const verified = finalise(await validateAndEnrich(filtered));

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

    const unlockedBadges = await recordRecCall(userId, isSubscribed);

    return Response.json({
      recommendations: verified,
      key,
      setId,
      unlockedBadges,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Recommend route error:", err);
    return Response.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
