import type { RedditQuote } from "@/types/reddit";

export type ResolvedTitle = {
  tmdbId: number;
  title: string;
  poster: string | null;
  year: number | null;
  description: string | null;
  reason: string;
  redditQuotes: RedditQuote[];
};

/**
 * Reorders `resolved` so that titles NOT in `prevTmdbIds` come first
 * (keeping their relative AI-returned order), followed by titles that
 * were already present in the previous batch.
 */
export function prioritiseNewTitles(
  resolved: ResolvedTitle[],
  prevTmdbIds: Set<number>
): ResolvedTitle[] {
  const newTitles = resolved.filter((r) => !prevTmdbIds.has(r.tmdbId));
  const returningTitles = resolved.filter((r) => prevTmdbIds.has(r.tmdbId));
  return [...newTitles, ...returningTitles];
}
