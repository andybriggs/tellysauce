"use client";

import { BookmarkIcon } from "@heroicons/react/24/solid";
import { useWatchList } from "../hooks/useWatchList";
import type { Show } from "../types";

type Props = {
  show?: Omit<Show, "rating">;
  className?: string;
};

export default function WatchlistButton({ show, className }: Props) {
  const { hasMounted, isSaved, toggle } = useWatchList();

  const hasValidId = typeof show?.id === "number";
  const saved = hasMounted && hasValidId ? isSaved(show!.id) : false;

  const label = saved ? "Remove from watchlist" : "Add to watchlist";
  const title = saved
    ? "Remove from watchlist"
    : hasValidId
    ? "Add to watchlist"
    : "Show not available";

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={!hasValidId}
      onClick={(e) => {
        e.preventDefault();
        if (!show || !hasValidId) return;
        // store same shape as rated titles (rating will be set to 0 in hook)
        toggle(show);
      }}
      className={[
        "inline-flex items-center gap-2 rounded-xl ring-1 px-4 py-2 transition mt-4 sm:mt-0 mr-auto sm:mr-0",
        saved
          ? "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30 hover:bg-emerald-500/25"
          : "bg-white/10 text-white ring-white/15 hover:bg-white/20",
        !hasValidId ? "opacity-50 cursor-not-allowed" : "",
        className ?? "",
      ].join(" ")}
      title={title}
    >
      <BookmarkIcon className="h-4" />
      <span>{label}</span>
    </button>
  );
}
