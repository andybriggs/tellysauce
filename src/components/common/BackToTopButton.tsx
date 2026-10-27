"use client";

import { useEffect, useState } from "react";
import { ChevronUpIcon } from "@heroicons/react/24/solid";

/** Far enough down that the button is not competing with the filter header. */
const SHOW_AFTER = 500;

/**
 * Floating "back to top" control for the long grid pages (watchlist, rated
 * titles), where the filters live at the very top and a full library is a lot of
 * scrolling to undo.
 *
 * z-40 matches the other fixed controls: above page content, below the z-60
 * modal layer. Bottom-right is free at every breakpoint - the trophy case is
 * top-right on mobile and mid-right-edge from `sm` up.
 */
export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll(); // a reload partway down the page should start in the right state
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      data-testid="back-to-top"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-gray-900/90 text-white shadow-2xl backdrop-blur transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:bottom-8 sm:right-6"
    >
      <ChevronUpIcon className="h-5 w-5" />
    </button>
  );
}
