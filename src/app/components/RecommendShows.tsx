"use client";

import { useGeminiRecommendations } from "../hooks/useRecommendations";
import { useMemo } from "react";
import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { useMyRatedShows } from "../hooks/useMyRatedShows";

export default function RecommendShows() {
  const { myRatedShows } = useMyRatedShows();
  const { recommendations, isLoading, getRecommendations } =
    useGeminiRecommendations();

  const handleClick = () => {
    const showList = myRatedShows.map((show) => ({
      name: show.name,
      rating: show.rating,
    }));
    getRecommendations(showList);
  };
  const hasShows = useMemo(
    () => myRatedShows.length > 0,
    [myRatedShows.length]
  );

  if (!hasShows) {
    return (
      <div className="mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal mb-2">
          Recommendations
        </h2>
        <div className="flex items-stretch gap-4 overflow-auto py-4">
          <div className="flex flex-col justify-center items-center rounded-2xl bg-gray-800/60 border-2 border-dashed border-gray-600 text-gray-300 w-48 min-h-[12rem] flex-shrink-0 p-4 cursor-pointer hover:border-gray-400 transition">
            <p className="text-center text-sm font-medium">
              Add shows to get recommendations
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex w-full sm:w-auto justify-center">
        <div
          className={[
            "group relative rounded-full p-[2px]",
            "bg-[conic-gradient(at_10%_10%,#7c3aed,#22d3ee,#f59e0b,#ec4899,#7c3aed)]",
            "shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]",
          ].join(" ")}
        >
          <button
            onClick={handleClick}
            disabled={isLoading}
            aria-live="polite"
            className={[
              "relative rounded-full px-8 py-4",
              "bg-slate-900/95 text-white",
              "font-semibold text-lg tracking-wide",
              "flex items-center justify-center gap-3",
              "shadow-lg ring-1 ring-white/10",
              "transition-transform active:scale-[0.99]",
              isLoading ? "cursor-wait" : "group-hover:bg-slate-900",
            ].join(" ")}
          >
            <>
              {isLoading ? (
                <ArrowPathIcon className="animate-spin h-6 w-6" />
              ) : (
                <SparklesIcon className="h-6 w-6" />
              )}
              <span>
                {recommendations.length ? "Refresh" : "Get"} Recommendations
              </span>
            </>
          </button>
        </div>
      </div>

      <ul className="mt-6 space-y-4">
        {recommendations.map((rec, idx) => (
          <li
            key={idx}
            className="bg-white rounded-xl p-4 shadow-md flex flex-col sm:flex-row sm:justify-between sm:items-center"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {rec.title}
              </h3>
              <p>
                {rec.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset mr-1"
                  >
                    {tag}
                  </span>
                ))}
              </p>
              <h4 className="font-bold mt-3">Description</h4>
              <p className="text-gray-700 text-sm mt-1">{rec.description}</p>
              <h4 className="font-bold mt-3">
                Why we think you&apos;ll like it
              </h4>
              <p className="text-gray-700 text-sm mt-1">{rec.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
