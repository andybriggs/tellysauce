"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import animationData from "./celebration.json";

// Loaded only when a badge actually unlocks, so the player and the animation
// JSON stay out of every other page's bundle. LottieSvg carries a single
// renderer rather than all three, which is all this needs.
const LottieSvg = dynamic(
  () => import("lottie-react").then((m) => m.LottieSvg),
  { ssr: false }
);

/**
 * The celebratory animation behind an unlocked badge. Decorative only - it sits
 * behind the rosette and is hidden from assistive tech.
 */
export default function BadgeCelebration() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      // The animation is a "NICE!" word-mark, so it needs its own space at its
      // native 662x390 ratio rather than sitting behind the badge.
      className="pointer-events-none w-44 aspect-[662/390] -mb-2"
      aria-hidden="true"
      data-testid="badge-celebration"
    >
      <LottieSvg
        src={animationData}
        loop={false}
        autoplay={!reducedMotion}
        className="w-full h-full"
      />
    </div>
  );
}
