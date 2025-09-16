"use client";

import { useMyShows } from "@/app/hooks/useMyShows"; // ← adjust if your hook lives elsewhere
import type { Show } from "@/app/types"; // ← adjust to your actual types path

interface SaveToggleButtonProps {
  show: Omit<Show, "rating">;
  size?: "sm" | "md";
}

export default function SaveToggleButton({
  show,
  size = "md",
}: SaveToggleButtonProps) {
  const { hasMounted, isSaved, addShow, removeShow } = useMyShows();

  const saved = hasMounted ? isSaved(show.id) : false;

  const base =
    "inline-flex items-center gap-2 rounded-xl ring-1 transition focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const sizing = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-base";

  const savedStyles =
    "bg-emerald-600/20 text-emerald-200 ring-emerald-400/30 hover:bg-emerald-600/30";
  const unsavedStyles =
    "bg-white/10 text-white ring-white/15 hover:bg-white/20";

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        if (!hasMounted) return;
        if (saved) removeShow(show.id);
        else addShow(show);
      }}
      className={[base, sizing, saved ? savedStyles : unsavedStyles].join(" ")}
      disabled={!hasMounted}
      title={saved ? "Remove from My Shows" : "Add to My Shows"}
    >
      {saved ? (
        // Filled bookmark
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={size === "sm" ? "h-4 w-4" : "h-5 w-5"}
        >
          <path
            fillRule="evenodd"
            d="M6.32 2.577A2.25 2.25 0 0 1 8.25 2h7.5a2.25 2.25 0 0 1 2.25 2.25V21a.75.75 0 0 1-1.136.643L12 18.089l-4.864 3.554A.75.75 0 0 1 6 21V4.25c0-.79.428-1.518 1.12-1.9z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // Outline bookmark with plus
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={size === "sm" ? "h-4 w-4" : "h-5 w-5"}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 21 12 17.25 6.75 21V4.5A2.25 2.25 0 0 1 9 2.25h6A2.25 2.25 0 0 1 17.25 4.5V21z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 7v6m3-3H9"
          />
        </svg>
      )}
      <span className="hidden sm:inline">
        {saved ? "Remove from my tites" : "Add to my titles"}
      </span>
    </button>
  );
}
