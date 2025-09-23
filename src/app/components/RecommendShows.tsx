"use client";

import { useMemo, useState } from "react";
import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { useGeminiRecommendations } from "../hooks/useRecommendations";
import { useWatchList } from "../hooks/useWatchList";
import Link from "next/link";
import { useRatedShows } from "../hooks/useRatedShows";

export default function RecommendShows() {
  const { ratedShows } = useRatedShows();
  const { watchList } = useWatchList();

  const { recommendations, isLoading, getRecommendations } =
    useGeminiRecommendations();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [opening, setOpening] = useState<number | null>(null);

  const hasShows = useMemo(() => ratedShows.length > 0, [ratedShows.length]);

  const handleClick = () => {
    const showList = ratedShows.map((s) => ({
      name: s.name,
      rating: s.rating,
    }));
    const watchListTitles = watchList?.map((title) => title.name);
    getRecommendations(showList, watchListTitles);
  };

  if (!hasShows) {
    return (
      <div className="mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal mb-2">
          Recommendations
        </h2>
        <div className="flex items-stretch gap-4 overflow-auto py-4">
          <div className="flex flex-col justify-center items-center rounded-2xl bg-gray-800/60 border-2 border-dashed border-gray-600 text-gray-300 w-48 min-h-[12rem] flex-shrink-0 p-4">
            <p className="text-center text-sm font-medium">
              Rate titles to get recommendations
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-3xl p-6 sm:p-8 md:p-10 inset-0 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80 ring-1 ring-white/10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-3xl md:text-4xl font-semibold tracking-tight">
            Smart picks for you
          </h2>
          <p className="mt-1 text-white/60 text-sm md:text-base">
            Based on your rated shows
          </p>
        </div>

        {/* Refresh button */}
        <div className="group relative rounded-full p-[2px] bg-[conic-gradient(at_10%_10%,#7c3aed,#22d3ee,#f59e0b,#ec4899,#7c3aed)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]">
          <button
            onClick={handleClick}
            disabled={isLoading}
            aria-live="polite"
            className={[
              "relative rounded-full px-6 md:px-8 py-3 md:py-4",
              "bg-slate-900/90 text-white font-semibold text-sm md:text-base tracking-wide",
              "flex items-center justify-center gap-2 md:gap-3",
              "shadow-lg ring-1 ring-white/10 backdrop-blur transition-[transform,background] active:scale-[0.99]",
              isLoading ? "cursor-wait" : "group-hover:bg-slate-900",
            ].join(" ")}
          >
            {isLoading ? (
              <ArrowPathIcon className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
            ) : (
              <SparklesIcon className="h-5 w-5 md:h-6 md:w-6" />
            )}
            <span className="hidden sm:inline">
              {recommendations.length ? "Refresh" : "Get"} Recommendations
            </span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="rounded-3xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 shadow-lg p-6 animate-pulse"
            >
              <div className="h-6 w-2/3 bg-white/20 rounded mb-4" />
              <div className="h-4 w-full bg-white/10 rounded mb-2" />
              <div className="h-4 w-5/6 bg-white/10 rounded mb-4" />
              <div className="h-3 w-24 bg-white/15 rounded" />
            </li>
          ))}
        </ul>
      )}

      {/* Cards */}
      {!isLoading && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((rec, idx) => (
            <li
              key={idx}
              role="button"
              tabIndex={0}
              className={[
                "relative overflow-hidden rounded-3xl p-8  cursor-pointer",
                "bg-white/10 backdrop-blur-md ring-1 ring-white/15 shadow-[0_8px_30px_rgb(0,0,0,0.25)]",
                "hover:bg-white/[.12] hover:ring-white/20 transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-cyan-400/60",
              ].join(" ")}
            >
              <Link
                href={`/open/title?q=${encodeURIComponent(rec.title)}`}
                aria-label={`Open ${rec.title}`}
              >
                {/* AI Pick tag — absolute top-right */}
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15 whitespace-nowrap">
                  <SparklesIcon className="h-4 w-4" />
                  AI pick
                </span>

                <h3 className="pr-24 text-white text-2xl md:text-[28px] font-semibold tracking-tight leading-tight">
                  {rec.title}
                </h3>

                {rec.tags?.length ? (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {rec.tags.slice(0, 4).map((t: string) => (
                      <span
                        key={t}
                        className="rounded-full bg-black/25 px-4 py-2 text-[14px] text-white/80 ring-1 ring-white/10"
                      >
                        {t}
                      </span>
                    ))}
                  </p>
                ) : null}

                {rec.description && (
                  <p className="mt-4 text-white/85 text-base md:text-lg leading-relaxed line-clamp-3">
                    {rec.description}
                  </p>
                )}

                {rec.reason && (
                  <div className="mt-5">
                    <div className="flex items-center gap-3">
                      <span className="h-px w-6 bg-white/15" />
                      <h4 className="text-[11px] font-medium tracking-wider text-white/65">
                        Why we think you’ll like it
                      </h4>
                    </div>
                    <p className="mt-2 text-white/75 text-sm md:text-base leading-relaxed line-clamp-3">
                      {rec.reason}
                    </p>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
