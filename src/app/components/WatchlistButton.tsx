// app/components/WatchlistButton.tsx
"use client";

import { useWatchList } from "../hooks/useWatchList";
import type { Show } from "../types";

type Props = {
  // pass the same fields you store in rated titles (minus rating)
  show?: Omit<Show, "rating">;
  className?: string;
};

export default function WatchlistButton({ show, className }: Props) {
  const { hasMounted, isSaved, toggle } = useWatchList();

  const hasValidId = typeof show?.id === "number";
  const saved = hasMounted && hasValidId ? isSaved(show!.id) : false;

  const label = saved ? "In watchlist" : "Add to watchlist";
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
        "inline-flex items-center gap-2 rounded-xl ring-1 px-4 py-2 transition",
        saved
          ? "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30 hover:bg-emerald-500/25"
          : "bg-white/10 text-white ring-white/15 hover:bg-white/20",
        !hasValidId ? "opacity-50 cursor-not-allowed" : "",
        className ?? "",
      ].join(" ")}
      title={title}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.25 21 12 17.25 6.75 21V4.5A2.25 2.25 0 0 1 9 2.25h6A2.25 2.25 0 0 1 17.25 4.5V21z"
        />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
