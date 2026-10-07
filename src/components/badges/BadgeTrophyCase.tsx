"use client";

import { useState } from "react";
import Modal from "@/components/common/Modal";
import BadgeRosette from "./BadgeRosette";
import BadgeShelf from "./BadgeShelf";
import { useBadges } from "@/hooks/useBadges";
import useIsLoggedIn from "@/hooks/useIsLoggedIn";
import type { BadgeCategory } from "@/lib/badges";

const CATEGORIES: BadgeCategory[] = ["watchlist", "rated", "recs"];

/**
 * Persistent trophy case opening a tray of every badge. Global rather than
 * per-page, so the recommendation badges have a home too - no page lists AI
 * recommendations.
 *
 * Two shapes: on mobile a round bubble in the top-right, sitting beside the
 * HeaderMenu burger at `right-16`; from `sm` up the original tab pinned to the
 * middle of the right edge, since the inline header owns that corner there.
 */
export default function BadgeTrophyCase() {
  const isLoggedIn = useIsLoggedIn();
  const { earnedCount, totalCount } = useBadges();
  const [open, setOpen] = useState(false);

  if (!isLoggedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Trophy case - ${earnedCount} of ${totalCount} badges earned`}
        data-testid="trophy-case-tab"
        className="fixed z-40 flex items-center justify-center border border-white/15 bg-gray-900/90 backdrop-blur shadow-2xl transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 top-3 right-3 h-11 w-11 rounded-full sm:top-1/2 sm:right-0 sm:h-auto sm:w-auto sm:-translate-y-1/2 sm:flex-col sm:gap-0.5 sm:rounded-full sm:rounded-l-2xl sm:rounded-r-none sm:border-r-0 sm:px-2 sm:py-3 sm:hover:pr-3"
      >
        <span className="sm:hidden">
          <BadgeRosette tier={3} size={28} showNumber={false} />
        </span>
        <span className="hidden sm:block">
          <BadgeRosette tier={3} size={36} showNumber={false} />
        </span>

        {/* Mobile has no room for the count inline, so it rides on the corner. */}
        <span className="absolute -top-1 -right-1 rounded-full bg-gray-900 px-1.5 text-[10px] font-semibold leading-4 text-gray-200 tabular-nums ring-1 ring-white/20 sm:static sm:bg-transparent sm:px-0 sm:text-gray-300 sm:ring-0">
          <span className="sm:hidden">{earnedCount}</span>
          <span className="hidden sm:inline">
            {earnedCount}/{totalCount}
          </span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        variant="drawer"
        className="max-w-sm"
        labelledBy="trophy-case-title"
      >
        <div className="p-6">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2
              id="trophy-case-title"
              className="text-2xl font-bold text-white"
            >
              Trophy case
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition text-xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            {earnedCount} of {totalCount} badges earned
          </p>

          {CATEGORIES.map((category) => (
            <BadgeShelf key={category} category={category} />
          ))}
        </div>
      </Modal>
    </>
  );
}
