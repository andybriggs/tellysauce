/**
 * Query-shape rules for the TMDB discover carousels.
 *
 * The important thing these encode: TMDB's `popularity` metric rewards steady
 * page traffic, so an unfiltered `popularity.desc` on /discover/tv returns
 * daily-airing talk shows and soaps (Watch What Happens Live, The Tonight Show,
 * Law & Order: SVU) rather than anything a viewer is looking to start. Every
 * constant below exists to keep those out.
 */

/** News, Reality, Talk, Soap, Kids. */
export const EXCLUDED_TV_GENRES = ["10763", "10764", "10767", "10766", "10762"];

/** News, Reality, Talk — kept broader for the all-time list, which is sorted by score. */
export const EXCLUDED_TV_GENRES_ALLTIME = ["10763", "10764", "10767"];

export const REGIONAL_AIR_WINDOW_DAYS = 90;
export const RECENT_TV_AIR_WINDOW_DAYS = 90;
export const RECENT_MOVIE_RELEASE_WINDOW_DAYS = 180;

/**
 * A show first aired longer ago than this is treated as an evergreen
 * long-runner rather than something to recommend. TMDB has no discover
 * parameter for "not a decades-old continuing series", so this is applied
 * after the fetch.
 */
export const EVERGREEN_MAX_AGE_YEARS = 6;

export function daysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Drops long-running series while keeping recent ones. This is the single
 * filter that separates Slow Horses (2022) from Coronation Street (1960).
 */
export function dropEvergreenSeries<T extends { first_air_date?: string | null }>(
  results: T[],
  now: Date = new Date()
): T[] {
  const cutoff = now.getFullYear() - EVERGREEN_MAX_AGE_YEARS;
  return results.filter((r) => {
    const raw = r.first_air_date?.slice(0, 4);
    // Keep anything with no usable date rather than silently dropping it.
    // Note Number("") is 0, not NaN, so the emptiness check has to come first.
    if (!raw) return true;
    const year = Number(raw);
    return !Number.isFinite(year) || year >= cutoff;
  });
}

/** Merges paged TMDB results, dropping duplicate ids. */
export function mergePages<T extends { id: number }>(pages: { results?: T[] }[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const page of pages) {
    for (const r of page.results ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}
