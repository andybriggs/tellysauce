"use client";

import { useState } from "react";
import { BookmarkIcon } from "@heroicons/react/24/solid";
import { useWatchList } from "@/hooks/useWatchList";
import { useRatedTitles } from "@/hooks/useRatedTitles";
import useIsLoggedIn from "@/hooks/useIsLoggedIn";
import type { Title } from "@/types/";

type Props = {
  title?: Omit<Title, "rating">;
  className?: string;
};

export default function WatchlistButton({ title, className }: Props) {
  const { hasMounted, isSaved, toggle } = useWatchList();
  const { isSaved: isRated } = useRatedTitles();
  const isLoggedIn = useIsLoggedIn();
  const [isPending, setIsPending] = useState(false);

  if (!isLoggedIn) return null;
  if (hasMounted && title && isRated(title.id)) return null;

  const hasValidId = typeof title?.id === "number";
  const saved = hasMounted && hasValidId ? isSaved(title.id) : false;

  const label = saved ? "Remove from watchlist" : "Add to watchlist";
  const htmlTitle = saved
    ? "Remove from watchlist"
    : hasValidId
    ? "Add to watchlist"
    : "Title not available";

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={!hasValidId || isPending}
      onClick={async (e) => {
        e.preventDefault();
        if (!title || !hasValidId) return;
        setIsPending(true);
        try {
          await toggle(title);
        } finally {
          setIsPending(false);
        }
      }}
      className={[
        "inline-flex items-center gap-2 rounded-xl ring-1 px-4 py-2 transition",
        saved
          ? "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30 hover:bg-emerald-500/25"
          : "bg-white/10 text-white ring-white/15 hover:bg-white/20",
        !hasValidId || isPending ? "opacity-50 cursor-not-allowed" : "",
        className ?? "",
      ].join(" ")}
      title={htmlTitle}
    >
      {isPending ? (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : (
        <BookmarkIcon className="h-4" />
      )}
      <span>{label}</span>
    </button>
  );
}
