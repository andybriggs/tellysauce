"use client";

import { useEffect, useState } from "react";

/** Matches the bottom edge of the top-3 + h-11 buttons, plus breathing room. */
const BAR_HEIGHT = "h-[68px]";

/** Far enough that the bar does not flicker on small rubber-band scrolls. */
const SCROLL_THRESHOLD = 24;

/**
 * Backdrop for the fixed mobile controls (HeaderMenu burger and the trophy case
 * bubble). They sit over page content once you scroll past the hero, so this
 * fades in behind them to keep them legible.
 *
 * z-30 is deliberate: under the z-40 buttons it backs, over page content.
 * Mobile only - from sm up the burger is gone and the trophy case moves to the
 * right edge, so nothing overlaps the top of the page.
 */
export default function MobileTopBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll(); // a reload partway down the page should start in the right state
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="mobile-top-bar"
      data-scrolled={scrolled}
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 sm:hidden ${BAR_HEIGHT} border-b border-white/10 bg-gray-900/90 backdrop-blur transition-opacity duration-200 ${
        scrolled ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
