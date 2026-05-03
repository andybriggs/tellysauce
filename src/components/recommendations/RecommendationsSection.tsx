"use client";

import { useEffect, useMemo } from "react";
import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/solid";
import TitleList from "@/components/title/TitleList";
import PaywallModal from "./PaywallModal";
import { useRatedTitles } from "@/hooks/useRatedTitles";
import { useWatchList } from "@/hooks/useWatchList";
import { useRecommendations } from "@/hooks/useRecommendations";
import type { SeedInput } from "@/types";

/* ---------- Helpers ---------- */

type IdName = { id?: number; name?: string };

function isIdName(v: unknown): v is IdName {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.name === "string" || typeof obj.id === "number";
}

/* ---------- Component ---------- */

export default function RecommendationsSection({
  seed,
  autoRun = false,
  buttonLabel,
}: {
  seed?: SeedInput;
  autoRun?: boolean;
  buttonLabel?: string;
}) {
  const { ratedTitles } = useRatedTitles();
  const { watchList } = useWatchList();

  const { titles, isLoading, paywallError, clearPaywall, generate } = useRecommendations({ seed });

  const isSeedMode = !!seed;

  // In seed mode, only show the section if the seed title is in the user's list
  const isCurrentTitleKnown = useMemo(() => {
    if (!isSeedMode) return true;
    const tmdbId = seed?.external?.tmdbId;
    const name = seed?.title ?? "";
    const ratedHit = Array.isArray(ratedTitles) &&
      ratedTitles.some((s) => (typeof tmdbId === "number" ? s.id === tmdbId : s.name === name));
    const watchHit = Array.isArray(watchList) &&
      watchList.some((w) => isIdName(w) && (typeof tmdbId === "number" ? w.id === tmdbId : w.name === name));
    return ratedHit || watchHit;
  }, [isSeedMode, seed, ratedTitles, watchList]);

  const hasTitles = isSeedMode ? true : (ratedTitles?.length ?? 0) > 0;

  useEffect(() => {
    if (autoRun && seed && titles.length === 0 && !isLoading) {
      generate({ ratedTitles, watchList });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, seed]);

  if (isSeedMode && !isCurrentTitleKnown) return null;
  if (!hasTitles && !isSeedMode) return null;

  const label = buttonLabel ?? (seed ? "More like this" : "Smart picks for you");
  const hasResults = titles.length > 0;

  return (
    <>
      {paywallError && (
        <PaywallModal
          reason={paywallError ?? undefined}
          onClose={clearPaywall}
        />
      )}
      <section className="rounded-3xl p-6 sm:p-8 md:p-10 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80 ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-white text-3xl md:text-4xl font-semibold tracking-tight">
              {label}
            </h2>
            <p className="mt-1 text-white/70 text-sm md:text-base">
              {isSeedMode ? "Titles with similar tone, themes &amp; craft" : "Based on your rated titles"}
            </p>
          </div>

          <div className="group relative rounded-full p-[2px] bg-[conic-gradient(at_10%_10%,#7c3aed,#22d3ee,#f59e0b,#ec4899,#7c3aed)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]">
            <button
              type="button"
              onClick={() => generate({ ratedTitles, watchList })}
              disabled={!hasTitles || isLoading}
              aria-live="polite"
              className={[
                "relative rounded-full px-6 md:px-8 py-3 md:py-4",
                "bg-slate-900/90 text-white font-semibold text-sm md:text-base tracking-wide",
                "flex items-center justify-center gap-2 md:gap-3",
                "shadow-lg ring-1 ring-white/10 backdrop-blur transition-[transform,background] active:scale-[0.99]",
                isLoading ? "cursor-wait" : "group-hover:bg-slate-900",
                !hasTitles ? "opacity-60" : "",
              ].join(" ")}
            >
              {isLoading ? (
                <ArrowPathIcon className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
              ) : (
                <SparklesIcon className="h-5 w-5 md:h-6 md:w-6" />
              )}
              <span className="hidden sm:inline">
                {hasResults ? "Refresh" : "Get"} Recommendations
              </span>
              <span className="sm:hidden">{hasResults ? "Refresh" : "Get"}</span>
            </button>
          </div>
        </div>

        {/* Carousel or loading skeleton */}
        {isLoading ? (
          <div className="mt-4 flex gap-4 overflow-hidden py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex-none w-48 h-64 rounded-xl bg-white/20 animate-pulse"
              />
            ))}
          </div>
        ) : hasResults ? (
          <TitleList items={titles} layout="carousel" showStatusOverlay />
        ) : null}
      </section>
    </>
  );
}
