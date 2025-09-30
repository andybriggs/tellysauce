"use client";

import { useCallback, useMemo, useEffect } from "react";
import { useWatchList } from "@/hooks/useWatchList";
import { useGeminiRecommendations } from "@/hooks/useRecommendations";
import EmptyRecommendations from "./EmptyRecommendations";
import RecommendationsHeader from "./RecommendationsHeader";
import RecommendationSkeletonGrid from "./RecommendationSkeletonGrid";
import RecommendationsGrid from "./RecommendationsGrid";
import { useRatedShows } from "@/hooks/useRatedShows";

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
  const { ratedShows } = useRatedShows();
  const { watchList } = useWatchList();
  const { recommendations, isLoading, getFromProfile, getFromSeed } =
    useGeminiRecommendations(cacheKey);

  const isSeedMode = !!seed;

  const isCurrentTitleKnown = useMemo(() => {
    if (!isSeedMode) return true;

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

  useEffect(() => {
    if (autoRun && seed && !recommendations?.length && !isLoading) {
      handleClick();
    }
  }, [autoRun, seed, recommendations?.length, isLoading, handleClick]);

  if (isSeedMode && !isCurrentTitleKnown) return null;

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
