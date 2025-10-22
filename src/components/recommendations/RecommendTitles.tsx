"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import { useWatchList } from "@/hooks/useWatchList";
import EmptyRecommendations from "./EmptyRecommendations";
import RecommendationsHeader from "./RecommendationsHeader";
import RecommendationSkeletonGrid from "./RecommendationSkeletonGrid";
import RecommendationsGrid from "./RecommendationsGrid";
import { useRatedTitles } from "@/hooks/useRatedTitles";

/* ---------- Local types ---------- */

type Seed = {
  title: string;
  overview?: string;
  genres?: string[];
  year?: number;
  type?: "movie" | "tv";
  external?: { tmdbId?: number; imdbId?: string | null };
};

type IdName = { id?: number; name?: string };

/** The shape your UI uses everywhere */
export type Recommendation = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  year?: number | null;
};

/** GET /api/recommendations response (only fields we read) */
type RecommendationsGetResponse = {
  set: unknown | null;
  items: Array<{
    title: string;
    description?: string | null;
    reason?: string | null;
    tags?: string[] | null;
    year?: number | null;
  }>;
};

/** POST /api/recommend response (only fields we read) */
type RecommendPostResponse = {
  recommendations?: Array<{
    title: string;
    description?: string | null;
    reason?: string | null;
    tags?: unknown; // we’ll validate to string[]
    year?: number | null;
  }>;
  key?: string;
  setId?: string;
};

/* ---------- Type guards & utils ---------- */

function isIdName(v: unknown): v is IdName {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  const hasName = typeof obj.name === "string";
  const hasId = typeof obj.id === "number";
  return hasName || hasId;
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((t): t is string => typeof t === "string")
    : [];
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

function buildKey(seed?: Seed) {
  if (!seed) {
    const v = process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3";
    return `profile:${v}`;
  }
  const t = seed.type ?? "unknown";
  const tmdb = seed.external?.tmdbId;
  if (tmdb) return `seed:${t}:${tmdb}`;
  return `seed:${t}:${slugTitle(seed.title)}`;
}

// Small fallback if API forgot to include year
function deriveYearFrom(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

// Minimal fetch helper with typing
async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T | null> {
  const res = await fetch(input, init);
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ---------- Component ---------- */

export default function RecommendTitles({
  seed,
  autoRun = false,
  buttonLabel,
}: {
  seed?: Seed;
  cacheKey?: string;
  autoRun?: boolean;
  buttonLabel?: string;
}) {
  // Hooks: assume these are already typed in your project; we only use a subset.
  const { ratedTitles } = useRatedTitles();
  const { watchList } = useWatchList();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isSeedMode = !!seed;
  const key = useMemo(() => buildKey(seed), [seed]);

  const isCurrentTitleKnown = useMemo(() => {
    if (!isSeedMode) return true;

    const tmdbId = seed?.external?.tmdbId;
    const name = seed?.title ?? "";

    const ratedHit =
      Array.isArray(ratedTitles) &&
      ratedTitles.some((s) =>
        typeof tmdbId === "number" ? s.id === tmdbId : s.name === name
      );

    const watchHit =
      Array.isArray(watchList) &&
      watchList.some(
        (w) =>
          isIdName(w) &&
          (typeof tmdbId === "number" ? w.id === tmdbId : w.name === name)
      );

    return ratedHit || watchHit;
  }, [isSeedMode, seed, ratedTitles, watchList]);

  const hasTitles = useMemo(
    () => (isSeedMode ? true : (ratedTitles?.length ?? 0) > 0),
    [isSeedMode, ratedTitles?.length]
  );

  // Load persisted recommendations (GET /api/recommendations)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchJson<RecommendationsGetResponse>(
        `/api/recommendations?key=${encodeURIComponent(key)}`
      );
      if (!data || cancelled || !Array.isArray(data.items)) return;

      const mapped: Recommendation[] = data.items.map((i) => {
        const yearFromApi =
          typeof i.year === "number" && Number.isFinite(i.year) ? i.year : null;
        const year =
          yearFromApi ??
          deriveYearFrom(i.title) ??
          deriveYearFrom((i.tags ?? []).join(" ")) ??
          deriveYearFrom(i.description);

        return {
          title: i.title,
          description: i.description ?? "",
          reason: i.reason ?? "",
          tags: toStringArray(i.tags),
          year,
        };
      });

      setRecommendations(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      if (seed) {
        const watchListTitles =
          (Array.isArray(watchList) &&
            watchList
              .filter(isIdName)
              .map((w) => w.name)
              .filter(Boolean)) ||
          [];

        const data = await fetchJson<RecommendPostResponse>("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "seed",
            seed,
            watchList: watchListTitles,
          }),
        });
        if (!data) return;

        const recs: Recommendation[] = Array.isArray(data.recommendations)
          ? data.recommendations.map((r) => {
              const year =
                typeof r.year === "number" && Number.isFinite(r.year)
                  ? r.year
                  : deriveYearFrom(r.title) ??
                    deriveYearFrom(toStringArray(r.tags).join(" ")) ??
                    deriveYearFrom(r.description ?? null);

              return {
                title: r.title,
                description: r.description ?? "",
                reason: r.reason ?? "",
                tags: toStringArray(r.tags),
                year,
              };
            })
          : [];
        setRecommendations(recs);
      } else {
        const titleList =
          (ratedTitles ?? []).map((s) => ({
            name: s.name,
            rating: s.rating,
          })) || [];

        const watchListTitles =
          (Array.isArray(watchList) &&
            watchList
              .filter(isIdName)
              .map((w) => w.name)
              .filter(Boolean)) ||
          [];

        const data = await fetchJson<RecommendPostResponse>("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "profile",
            titles: titleList,
            watchList: watchListTitles,
          }),
        });
        if (!data) return;

        const recs: Recommendation[] = Array.isArray(data.recommendations)
          ? data.recommendations.map((r) => {
              const year =
                typeof r.year === "number" && Number.isFinite(r.year)
                  ? r.year
                  : deriveYearFrom(r.title) ??
                    deriveYearFrom(toStringArray(r.tags).join(" ")) ??
                    deriveYearFrom(r.description ?? null);

              return {
                title: r.title,
                description: r.description ?? "",
                reason: r.reason ?? "",
                tags: toStringArray(r.tags),
                year,
              };
            })
          : [];
        setRecommendations(recs);
      }
    } finally {
      setIsLoading(false);
    }
  }, [seed, ratedTitles, watchList]);

  useEffect(() => {
    if (autoRun && seed && !recommendations.length && !isLoading) {
      handleClick();
    }
  }, [autoRun, seed, recommendations.length, isLoading, handleClick]);

  if (isSeedMode && !isCurrentTitleKnown) return null;
  if (!hasTitles && !isSeedMode) return <EmptyRecommendations />;

  return (
    <section className="mt-6 rounded-3xl p-6 sm:p-8 md:p-10 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80 ring-1 ring-white/10">
      <RecommendationsHeader
        onClick={handleClick}
        isLoading={isLoading}
        canRun={hasTitles}
        hasResults={recommendations.length > 0}
        label={buttonLabel ?? (seed ? "Find similar titles" : undefined)}
      />
      {isLoading ? (
        <RecommendationSkeletonGrid count={6} />
      ) : (
        <RecommendationsGrid items={recommendations} />
      )}
    </section>
  );
}
