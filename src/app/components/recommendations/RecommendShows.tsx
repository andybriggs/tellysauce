"use client";

import { useCallback, useMemo } from "react";
import { useWatchList } from "@/app/hooks/useWatchList";
import { useGeminiRecommendations } from "@/app/hooks/useRecommendations";
import EmptyRecommendations from "./EmptyRecommendations";
import RecommendationsHeader from "./RecommendationsHeader";
import RecommendationSkeletonGrid from "./RecommendationSkeletonGrid";
import RecommendationsGrid from "./RecommendationsGrid";
import { useRatedShows } from "@/app/hooks/useRatedShows";

export default function RecommendShows() {
  const { ratedShows } = useRatedShows();
  const { watchList } = useWatchList();

  const { recommendations, isLoading, getRecommendations } =
    useGeminiRecommendations();

  const hasShows = useMemo(() => ratedShows?.length > 0, [ratedShows?.length]);

  const handleClick = useCallback(() => {
    const showList = ratedShows.map((s) => ({
      name: s.name,
      rating: s.rating,
    }));
    const watchListTitles = watchList?.map((title) => title.name) ?? [];
    getRecommendations(showList, watchListTitles);
  }, [getRecommendations, ratedShows, watchList]);

  if (!hasShows) return <EmptyRecommendations />;

  return (
    <section className="mt-6 rounded-3xl p-6 sm:p-8 md:p-10  bg-gradient-to-r from-pink-500 to-orange-400 opacity-80 ring-1 ring-white/10">
      <RecommendationsHeader
        onClick={handleClick}
        isLoading={isLoading}
        canRun={hasShows}
        hasResults={recommendations?.length > 0}
      />

      {isLoading ? (
        <RecommendationSkeletonGrid count={6} />
      ) : (
        <RecommendationsGrid items={recommendations} />
      )}
    </section>
  );
}
