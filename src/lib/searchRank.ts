/**
 * Re-ranks TMDB search results by how closely the title matches the query.
 *
 * TMDB's own ordering leans heavily on popularity, so a query for "The Pirates!"
 * opened with Jake and the Never Land Pirates and Pirates of the Caribbean, and
 * put "The Pirates! In an Adventure with Scientists!" 14th. Here the title match
 * decides the tier and popularity only breaks ties within a tier.
 */

export type RankCandidate = {
  title: string;
  /** TMDB vote_count - a steadier "is this a real, known title" signal than popularity. */
  voteCount?: number;
};

/**
 * Tier scores, 12 apart, with a popularity bonus of up to 20 on top (5 per
 * order of magnitude of votes). A title needs ~250x the votes to climb one
 * tier, so Dune: Part Two passes a 3-vote 1989 "Dune", and El Camino passes
 * "Breaking Bad Wolf", while near-unknowns cannot outrank a real match.
 * Exact matches differ only in punctuation, so they sit 2 apart, not a tier.
 */
const TIER = {
  /** Query matches the title exactly, punctuation included. */
  LITERAL_EXACT: 104,
  /**
   * Title starts with the query exactly as typed, when the query has punctuation.
   * The punctuation is deliberate, so "The Pirates!" ranks "The Pirates! In an
   * Adventure with Scientists!" above plain "The Pirates".
   */
  LITERAL_PREFIX: 102,
  /** Same words as the title, ignoring case and punctuation. */
  EXACT: 100,
  /** Title starts with the query, e.g. "The Pirates" -> "The Pirates of Somalia". */
  PREFIX: 88,
  /**
   * Starts with the query once a leading article is dropped ("The Pirates" ->
   * "Pirates of the Caribbean"), or contains it as a phrase ("Peter Pan & the
   * Pirates"). One tier: neither is clearly the better match.
   */
  NEAR: 76,
  /** Every query word appears somewhere in the title. */
  ALL_WORDS: 64,
  /** Scaled by the share of query words present. */
  SOME_WORDS: 52,
} as const;

const POPULARITY_MAX = 20;

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Lowercase, no accents, "&" -> "and", punctuation dropped, single spaces. */
export function normaliseTitle(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lowercase and collapsed whitespace, punctuation kept. */
function literal(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function dropLeadingArticle(s: string): string {
  return s.replace(/^(the|a|an) /, "");
}

function hasWordAt(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/** How well a title matches the query, by tier. 0 means no word in common. */
export function titleMatchScore(query: string, title: string): number {
  const lq = literal(query);
  const lt = literal(title);
  if (!lq || !lt) return 0;
  if (lq === lt) return TIER.LITERAL_EXACT;

  const q = normaliseTitle(query);
  const t = normaliseTitle(title);
  if (!q || !t) return 0;

  // Punctuation in the query is deliberate ("The Pirates!", "Mission: Impossible"),
  // so a title that starts with it exactly as typed is the most specific match.
  const queryHasPunctuation = lq !== q;
  if (queryHasPunctuation && lt.startsWith(lq)) return TIER.LITERAL_PREFIX;

  const qNoArticle = dropLeadingArticle(q);
  const tNoArticle = dropLeadingArticle(t);
  // "office" is an exact match for "The Office".
  if (q === t || q === tNoArticle) return TIER.EXACT;
  // Plain string prefix, not word-bounded, so a half-typed last word still matches.
  if (t.startsWith(q)) return TIER.PREFIX;

  if (qNoArticle && tNoArticle.startsWith(qNoArticle)) return TIER.NEAR;
  if (hasWordAt(t, q)) return TIER.NEAR;

  const qWords = [...new Set(q.split(" "))];
  const tWords = new Set(t.split(" "));
  const hits = qWords.filter((w) => tWords.has(w)).length;
  if (hits === qWords.length) return TIER.ALL_WORDS;
  return Math.round(TIER.SOME_WORDS * (hits / qWords.length));
}

/** 0-20, logarithmic: 5 per order of magnitude of votes (10k votes -> 20). */
function popularityBonus(voteCount = 0): number {
  return Math.min(POPULARITY_MAX, Math.log10(Math.max(0, voteCount) + 1) * 5);
}

/**
 * Stable sort by title match, then popularity. Items keep TMDB's order when
 * they score the same, so ties fall back to TMDB's own judgement.
 */
export function rankSearchResults<T extends RankCandidate>(query: string, items: T[]): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: titleMatchScore(query, item.title) + popularityBonus(item.voteCount),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
