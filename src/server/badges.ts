import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  badgesFor,
  type BadgeCategory,
} from "@/lib/badges";

export type { BadgeCategory };

export type BadgeProgress = Record<BadgeCategory, number>;

export type UserBadge = {
  key: string;
  awardedAt: string;
  seen: boolean;
};

type ExecResult<T> = { rows?: T[] };

function rowsOf<T>(result: unknown): T[] {
  return (result as ExecResult<T>).rows ?? [];
}

/**
 * Current progress for a category.
 *
 * Watchlist counts titles *currently* on the watchlist, which is what /watchlist
 * displays. Rating a watchlisted title flips the row to RATED and lowers this
 * count, but awards are permanent, so badges behave as a high-water mark.
 */
async function countFor(
  userId: string,
  category: BadgeCategory
): Promise<number> {
  if (category === "recs") {
    const res = await db.execute(
      sql`SELECT lifetime_rec_calls FROM users WHERE id = ${userId}`
    );
    return Number(rowsOf<{ lifetime_rec_calls: number }>(res)[0]?.lifetime_rec_calls ?? 0);
  }

  const status = category === "watchlist" ? "WATCHLIST" : "RATED";
  const res = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM user_titles WHERE user_id = ${userId} AND status = ${status}`
  );
  return Number(rowsOf<{ n: number }>(res)[0]?.n ?? 0);
}

/**
 * Award every badge in `category` whose threshold the user has met, and return
 * only the keys that were newly awarded by this call.
 *
 * Inserting *all* met tiers rather than just the one crossed means existing
 * users are backfilled on their next action. ON CONFLICT DO NOTHING makes the
 * whole thing idempotent and race-safe, which matters because the neon-http
 * driver has no transactions.
 *
 * Never throws - a badge failure must not break the write that triggered it.
 */
export async function awardBadges(
  userId: string,
  category: BadgeCategory
): Promise<string[]> {
  try {
    const tiers = badgesFor(category);
    const count = await countFor(userId, category);

    const earned = tiers.filter((b) => count >= b.threshold);
    if (earned.length === 0) return [];

    const values = sql.join(
      earned.map((b) => sql`(${userId}, ${b.key})`),
      sql`, `
    );

    const res = await db.execute(sql`
      INSERT INTO user_badges ("user_id", "badge_key")
      VALUES ${values}
      ON CONFLICT ON CONSTRAINT "user_badges_user_key_unique" DO NOTHING
      RETURNING "badge_key"
    `);

    return rowsOf<{ badge_key: string }>(res).map((r) => r.badge_key);
  } catch (err) {
    console.error("awardBadges failed:", err);
    return [];
  }
}

/**
 * Evaluate every category at once.
 *
 * Called on read as well as on write so that a user whose totals already meet a
 * threshold - anyone with history from before badges existed - is caught up the
 * next time the app asks for their badges, rather than having to perform an
 * action first. Idempotent, so doing this on every read is safe.
 */
export async function awardAllBadges(userId: string): Promise<string[]> {
  const results = await Promise.all(
    (["watchlist", "rated", "recs"] as BadgeCategory[]).map((c) =>
      awardBadges(userId, c)
    )
  );
  return results.flat();
}

/**
 * Current totals per category, so the trophy case can show progress against
 * unearned tiers without the client fetching the watchlist and ratings itself.
 */
export async function getBadgeProgress(userId: string): Promise<BadgeProgress> {
  try {
    const [watchlist, rated, recs] = await Promise.all([
      countFor(userId, "watchlist"),
      countFor(userId, "rated"),
      countFor(userId, "recs"),
    ]);
    return { watchlist, rated, recs };
  } catch (err) {
    console.error("getBadgeProgress failed:", err);
    return { watchlist: 0, rated: 0, recs: 0 };
  }
}

/** All badges a user has been awarded, newest first. */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  try {
    const res = await db.execute(sql`
      SELECT "badge_key", "seen", "awarded_at"
        FROM user_badges
       WHERE user_id = ${userId}
       ORDER BY "awarded_at" DESC
    `);

    return rowsOf<{ badge_key: string; seen: boolean; awarded_at: string | Date }>(res).map(
      (r) => ({
        key: r.badge_key,
        seen: r.seen,
        awardedAt:
          r.awarded_at instanceof Date
            ? r.awarded_at.toISOString()
            : String(r.awarded_at),
      })
    );
  } catch (err) {
    console.error("getUserBadges failed:", err);
    return [];
  }
}

/** Mark badges as celebrated so they are not re-shown on the next page load. */
export async function markBadgesSeen(
  userId: string,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  try {
    const list = sql.join(
      keys.map((k) => sql`${k}`),
      sql`, `
    );
    await db.execute(sql`
      UPDATE user_badges
         SET "seen" = true
       WHERE user_id = ${userId}
         AND "badge_key" IN (${list})
    `);
  } catch (err) {
    console.error("markBadgesSeen failed:", err);
  }
}
