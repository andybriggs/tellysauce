/**
 * Shared region setting. The storage key is deliberately the same one
 * WhereToWatch has always used, so a region chosen on a title page and a
 * region chosen in the header are the same choice.
 */
export const WATCH_REGION_KEY = "watch_region";

export const DEFAULT_REGION = "GB";

/** Ordering preference for the WhereToWatch dropdown. */
export const PRIORITY_REGIONS = ["GB", "US", "CA", "AU", "IE"];

export const SUPPORTED_REGIONS = PRIORITY_REGIONS;

/**
 * TMDB `with_origin_country` group for a region. A UK viewer wants Irish
 * co-productions too, an Australian viewer wants New Zealand, and so on, so
 * each region maps to a small group rather than a single country code.
 */
const ORIGIN_COUNTRIES: Record<string, string[]> = {
  GB: ["GB", "IE"],
  IE: ["IE", "GB"],
  AU: ["AU", "NZ"],
  NZ: ["NZ", "AU"],
  US: ["US", "CA"],
  CA: ["CA", "US"],
};

/**
 * Whether we have a real origin-country mapping for this region. Callers should
 * hide region-scoped UI when false rather than falling back to GB, otherwise
 * the heading names one country and the content comes from another.
 */
export function isSupportedRegion(region: string | null | undefined): boolean {
  return !!region && region.toUpperCase() in ORIGIN_COUNTRIES;
}

export function regionOriginCountries(region: string | null | undefined): string[] {
  if (!region) return ORIGIN_COUNTRIES[DEFAULT_REGION];
  return ORIGIN_COUNTRIES[region.toUpperCase()] ?? ORIGIN_COUNTRIES[DEFAULT_REGION];
}

export function regionLabel(region: string | null | undefined): string {
  if (!region) return regionLabel(DEFAULT_REGION);
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

/** localStorage -> navigator.language suffix -> DEFAULT_REGION. Client only. */
export function detectRegion(): string {
  try {
    const stored = localStorage.getItem(WATCH_REGION_KEY);
    if (stored) return stored;
    const parts = (navigator.language ?? "").split("-");
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
  } catch {
    /* SSR, or storage blocked */
  }
  return DEFAULT_REGION;
}

export function storeRegion(region: string): void {
  try {
    localStorage.setItem(WATCH_REGION_KEY, region);
  } catch {
    /* storage blocked */
  }
}
