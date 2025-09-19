// app/components/WatchlistButton.tsx (client)
"use client";

export default function WatchlistButton() {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        // TODO: implement watchlist; noop for now
      }}
      className="inline-flex items-center gap-2 rounded-xl bg-white/10 text-white ring-1 ring-white/15 px-4 py-2 hover:bg-white/20 transition"
      title="Add to watchlist"
    >
      {/* outline bookmark */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
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
      <span className="hidden sm:inline">Add to watchlist</span>
    </button>
  );
}
