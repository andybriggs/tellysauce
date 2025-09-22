"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMyRatedShows } from "@/app/hooks/useMyRatedShows";
import { useWatchList } from "@/app/hooks/useWatchList";
import { useGeminiRecommendations } from "@/app/hooks/useRecommendations";
import EmptyRecommendations from "./EmptyRecommendations";
import RecommendationsHeader from "./RecommendationsHeader";
import RecommendationSkeletonGrid from "./RecommendationSkeletonGrid";
import RecommendationsGrid from "./RecommendationsGrid";

export default function RecommendShows() {
  const { myRatedShows } = useMyRatedShows();
  const { watchList } = useWatchList();

  const { recommendations, isLoading, getRecommendations } =
    useGeminiRecommendations();
  const router = useRouter();

  // optional local opening indicator if you want to reflect a "pending open"
  const [opening, setOpening] = useState<string | null>(null);

  const hasShows = useMemo(
    () => myRatedShows.length > 0,
    [myRatedShows.length]
  );

  const handleClick = useCallback(() => {
    const showList = myRatedShows.map((s) => ({
      name: s.name,
      rating: s.rating,
    }));
    const watchListTitles = watchList?.map((title) => title.name) ?? [];
    getRecommendations(showList, watchListTitles);
  }, [getRecommendations, myRatedShows, watchList]);

  const openTitleByName = useCallback(
    async (title: string) => {
      try {
        setOpening((prev) => prev ?? title);
        const res = await fetch(
          `/api/resolve-title?q=${encodeURIComponent(title)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Resolve failed with ${res.status}`);
        const { id } = await res.json();
        if (id) router.push(`/title/${id}`);
        else alert(`Couldn't resolve Watchmode ID for “${title}”.`);
      } catch (e) {
        console.error(e);
        alert("Sorry—something went wrong opening that title.");
      } finally {
        setOpening(null);
      }
    },
    [router]
  );

  if (!hasShows) return <EmptyRecommendations />;

  return (
    <section className="mt-6 rounded-3xl p-6 sm:p-8 md:p-10 bg-gradient-to-br from-cyan-900 via-fuchsia-900 to-slate-900 ring-1 ring-white/10">
      <RecommendationsHeader
        onClick={handleClick}
        isLoading={isLoading}
        canRun={hasShows}
        hasResults={recommendations.length > 0}
      />

      {isLoading ? (
        <RecommendationSkeletonGrid count={6} />
      ) : (
        <RecommendationsGrid items={recommendations} onOpen={openTitleByName} />
      )}

      {/* Example: you could show which title is opening */}
      {opening && (
        <p className="sr-only" aria-live="polite">
          Opening {opening}…
        </p>
      )}
    </section>
  );
}
