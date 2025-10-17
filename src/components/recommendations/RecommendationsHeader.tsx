"use client";

import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { memo } from "react";

type Props = {
  onClick: () => void;
  isLoading: boolean;
  canRun: boolean;
  hasResults: boolean;
  label: string | undefined;
};

function Header({
  onClick,
  isLoading,
  canRun,
  hasResults,
  label = "Smart picks for you",
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-white text-3xl md:text-4xl font-semibold tracking-tight">
          {label}
        </h2>
        <p className="mt-1 text-white/60 text-sm md:text-base">
          Based on your rated titles
        </p>
      </div>

      <div className="group relative rounded-full p-[2px] bg-[conic-gradient(at_10%_10%,#7c3aed,#22d3ee,#f59e0b,#ec4899,#7c3aed)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]">
        <button
          type="button"
          onClick={onClick}
          disabled={!canRun || isLoading}
          aria-live="polite"
          className={[
            "relative rounded-full px-6 md:px-8 py-3 md:py-4",
            "bg-slate-900/90 text-white font-semibold text-sm md:text-base tracking-wide",
            "flex items-center justify-center gap-2 md:gap-3",
            "shadow-lg ring-1 ring-white/10 backdrop-blur transition-[transform,background] active:scale-[0.99]",
            isLoading ? "cursor-wait" : "group-hover:bg-slate-900",
            !canRun ? "opacity-60" : "",
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
  );
}

export default memo(Header);
