/**
 * Badge catalogue - the single source of truth for thresholds, names and copy.
 *
 * Imported by the server evaluator (src/server/badges.ts), the unlock modal and
 * the badge shelf, so it must stay free of server-only imports.
 */

export type BadgeCategory = "watchlist" | "rated" | "recs";
export type BadgeTier = 1 | 2 | 3 | 4 | 5;

export type BadgeDef = {
  key: string;
  category: BadgeCategory;
  tier: BadgeTier;
  threshold: number;
  name: string;
  unlockText: string;
};

export const BADGES: BadgeDef[] = [
  // --- Watchlist: titles currently on the watchlist ---
  {
    key: "watchlist_5",
    category: "watchlist",
    tier: 1,
    threshold: 5,
    name: "Queue Starter",
    unlockText: "You've lined up your first 5 titles. The sauce is simmering.",
  },
  {
    key: "watchlist_15",
    category: "watchlist",
    tier: 2,
    threshold: 15,
    name: "Shelf Stacker",
    unlockText: "15 titles saved for later. Your evenings are sorted.",
  },
  {
    key: "watchlist_30",
    category: "watchlist",
    tier: 3,
    threshold: 30,
    name: "Binge Architect",
    unlockText:
      "30 titles deep. You're not watching telly, you're planning a season.",
  },
  {
    key: "watchlist_50",
    category: "watchlist",
    tier: 4,
    threshold: 50,
    name: "Vault Keeper",
    unlockText: "50 titles locked away. Nothing good gets past you.",
  },
  {
    key: "watchlist_100",
    category: "watchlist",
    tier: 5,
    threshold: 100,
    name: "The Endless Queue",
    unlockText: "100 titles on your watchlist. You will never be bored again.",
  },

  // --- Ratings: titles with status RATED ---
  {
    key: "rated_5",
    category: "rated",
    tier: 1,
    threshold: 5,
    name: "Star Struck",
    unlockText: "You've rated 5 titles. First opinions, on the record.",
  },
  {
    key: "rated_15",
    category: "rated",
    tier: 2,
    threshold: 15,
    name: "Armchair Critic",
    unlockText:
      "15 ratings in. Everyone's got a take - yours is documented.",
  },
  {
    key: "rated_30",
    category: "rated",
    tier: 3,
    threshold: 30,
    name: "Taste Maker",
    unlockText:
      "30 titles rated. Your recommendations just got a lot sharper.",
  },
  {
    key: "rated_50",
    category: "rated",
    tier: 4,
    threshold: 50,
    name: "Resident Reviewer",
    unlockText:
      "50 ratings. You've watched more than most people talk about.",
  },
  {
    key: "rated_100",
    category: "rated",
    tier: 5,
    threshold: 100,
    name: "Golden Palate",
    unlockText: "100 titles rated. Your taste is officially calibrated.",
  },

  // --- AI recommendations: lifetime generations ---
  {
    key: "recs_1",
    category: "recs",
    tier: 1,
    threshold: 1,
    name: "First Taste",
    unlockText:
      "You've generated your first AI recommendations. Welcome to the good stuff.",
  },
  {
    key: "recs_3",
    category: "recs",
    tier: 2,
    threshold: 3,
    name: "Sauce Seeker",
    unlockText: "3 sets of AI picks. You're getting a feel for it.",
  },
  {
    key: "recs_10",
    category: "recs",
    tier: 3,
    threshold: 10,
    name: "Algorithm Whisperer",
    unlockText: "10 recommendation runs. The machine knows what you like.",
  },
  {
    key: "recs_25",
    category: "recs",
    tier: 4,
    threshold: 25,
    name: "Head Chef",
    unlockText: "25 recommendation runs. You've got this down to a recipe.",
  },
  {
    key: "recs_50",
    category: "recs",
    tier: 5,
    threshold: 50,
    name: "Oracle of Telly",
    unlockText:
      "50 recommendation runs. You see what's coming before it airs.",
  },
];

export const BADGE_BY_KEY: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.key, b])
);

/** Badges for a category, tier-ascending. */
export function badgesFor(category: BadgeCategory): BadgeDef[] {
  return BADGES.filter((b) => b.category === category).sort(
    (a, b) => a.tier - b.tier
  );
}

/** Human label for a category, used by the badge shelf. */
export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  watchlist: "Watchlist badges",
  rated: "Rating badges",
  recs: "AI recommendation badges",
};
