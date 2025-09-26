"use client";

import { useCallback, useMemo, useEffect } from "react";
import { useWatchList } from "@/app/hooks/useWatchList";
import { useGeminiRecommendations } from "@/app/hooks/useRecommendations";
import EmptyRecommendations from "./EmptyRecommendations";
import RecommendationsHeader from "./RecommendationsHeader";
import RecommendationSkeletonGrid from "./RecommendationSkeletonGrid";
import RecommendationsGrid from "./RecommendationsGrid";
import { useRatedShows } from "@/app/hooks/useRatedShows";

type Seed = {
  title: string;
  overview?: string;
  genres?: string[];
  year?: number;
  type?: "movie" | "tv";
  external?: { tmdbId?: number; imdbId?: string | null };
};

type IdName = { id?: number; name?: string };

// narrow unknowns safely
function isIdName(v: unknown): v is IdName {
  return typeof v === "object" && v !== null;
}

export default function RecommendShows({
  seed,
  cacheKey,
  autoRun = false,
  buttonLabel,
}: {
  seed?: Seed;
  cacheKey?: string;
  autoRun?: boolean;
  buttonLabel?: string;
}) {
  // -------- hooks (must be unconditional) --------
  const { ratedShows } = useRatedShows(); // typed Show[] from your hook
  const { watchList } = useWatchList(); // assume {id,name}[]
  const { recommendations, isLoading, getFromProfile, getFromSeed } =
    useGeminiRecommendations(cacheKey);

  const isSeedMode = !!seed;

  // Is this title already rated or on the watchlist? (for seed/title pages)
  const isCurrentTitleKnown = useMemo(() => {
    if (!isSeedMode) return true; // homepage/profile flow unaffected

    const tmdbId = seed?.external?.tmdbId;
    const name = seed?.title ?? "";

    const ratedHit =
      Array.isArray(ratedShows) &&
      ratedShows.some((s) =>
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
  }, [isSeedMode, seed, ratedShows, watchList]);

  // PROFILE mode requires some rated shows; seed mode can always run (user clicks)
  const hasShows = useMemo(
    () => (isSeedMode ? true : (ratedShows?.length ?? 0) > 0),
    [isSeedMode, ratedShows?.length]
  );

  const handleClick = useCallback(() => {
    if (seed) {
      const watchListTitles =
        (Array.isArray(watchList) &&
          watchList
            .filter(isIdName)
            .map((w) => w.name)
            .filter(Boolean)) ||
        [];
      getFromSeed(seed, watchListTitles as string[]);
    } else {
      const showList =
        (ratedShows ?? []).map((s) => ({
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
      getFromProfile(showList, watchListTitles as string[]);
    }
  }, [seed, getFromSeed, getFromProfile, ratedShows, watchList]);

  // Still opt-in; will only run if you pass autoRun
  useEffect(() => {
    if (autoRun && seed && !recommendations?.length && !isLoading) {
      handleClick();
    }
  }, [autoRun, seed, recommendations?.length, isLoading, handleClick]);

  // -------- render decisions (AFTER hooks) --------

  // In seed mode: hide entirely if user hasn't rated/added this title yet
  if (isSeedMode && !isCurrentTitleKnown) return null;

  // In profile mode: keep your original empty state when no rated shows
  if (!hasShows && !isSeedMode) return <EmptyRecommendations />;

  return (
    <section className="mt-6 rounded-3xl p-6 sm:p-8 md:p-10 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80 ring-1 ring-white/10">
      <RecommendationsHeader
        onClick={handleClick}
        isLoading={isLoading}
        canRun={hasShows}
        hasResults={recommendations?.length > 0}
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
