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
 * Persistent trophy case: a tab pinned to the right edge that opens a tray of
 * every badge. Global rather than per-page, so the recommendation badges have a
 * home too - no page lists AI recommendations.
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
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-0.5 rounded-l-2xl border border-r-0 border-white/15 bg-gray-900/90 backdrop-blur px-2 py-3 shadow-2xl transition hover:bg-gray-800 hover:pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <BadgeRosette tier={3} size={36} showNumber={false} />
        <span className="text-[10px] font-semibold text-gray-300 tabular-nums">
          {earnedCount}/{totalCount}
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
