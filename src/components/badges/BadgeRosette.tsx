"use client";

import { useId } from "react";
import type { BadgeTier } from "@/lib/badges";

type Palette = {
  /** ribbon tails */
  ribbon: string;
  /** darker ribbon shade, used for the underside */
  ribbonShade: string;
  /** petal ring, and the centre face unless `face` overrides it */
  burst: string;
  /** centre face, when it must differ from the petals (tier 5's gradient is
   *  too busy to read a numeral against) */
  face?: string;
  /** light rim between the petals and the face */
  disc: string;
  /** tier numeral */
  numeral: string;
};

/**
 * Tier palettes. Deliberately a first pass - swapping these hex values is the
 * only change needed to restyle every badge in the app.
 *
 * Tier 5 uses a gradient built from the same stops as the conic gradient on the
 * "Get Recommendations" button, so the top tier escalates an existing house
 * visual rather than introducing a new one.
 */
const PALETTES: Record<BadgeTier, Palette> = {
  1: { ribbon: "#7A4A21", ribbonShade: "#5C3717", burst: "#CD7F32", disc: "#E8B98A", numeral: "#4A2A0E" },
  2: { ribbon: "#5E6B7A", ribbonShade: "#47525E", burst: "#B8C2CC", disc: "#E9EEF2", numeral: "#35414D" },
  3: { ribbon: "#A9750A", ribbonShade: "#805806", burst: "#F4B400", disc: "#FFDE7A", numeral: "#5E3F00" },
  4: { ribbon: "#3E6B85", ribbonShade: "#2C4E63", burst: "#7FC5DC", disc: "#D8F1FA", numeral: "#14384A" },
  5: { ribbon: "#6D28D9", ribbonShade: "#4C1D95", burst: "#A855F7", face: "#5B21B6", disc: "#F5E9FF", numeral: "#FFFFFF" },
};

const LOCKED: Palette = {
  ribbon: "#4B5563",
  ribbonShade: "#374151",
  burst: "#6B7280",
  disc: "#9CA3AF",
  numeral: "#1F2937",
};

const PRISMATIC_STOPS = ["#7c3aed", "#22d3ee", "#f59e0b", "#ec4899"];

const CX = 100;
const CY = 92;
const PETAL_COUNT = 12;
const PETAL_ORBIT = 46;
const PETAL_RADIUS = 14;

/** Left ribbon outline; the right tail is this mirrored about x = 100. */
const RIBBON_LEFT: Array<[number, number]> = [
  [72, 124], // top outer
  [104, 124], // top inner
  [88, 194], // bottom inner
  [76, 176], // notch
  [56, 186], // bottom outer
];

const points = (pts: Array<[number, number]>) =>
  pts.map(([x, y]) => `${x},${y}`).join(" ");

const mirror = (pts: Array<[number, number]>): Array<[number, number]> =>
  pts.map(([x, y]) => [200 - x, y]);

type Props = {
  tier: BadgeTier;
  /** unearned badges render greyed out */
  earned?: boolean;
  size?: number;
  className?: string;
  /** false renders a plain rosette - used as the trophy case icon */
  showNumber?: boolean;
};

export default function BadgeRosette({
  tier,
  earned = true,
  size = 96,
  className,
  showNumber = true,
}: Props) {
  // Unique per instance so several rosettes on one page cannot collide
  const gradientId = useId();
  const palette = earned ? PALETTES[tier] : LOCKED;
  const isPrismatic = earned && tier === 5;
  const burstFill = isPrismatic ? `url(#${gradientId})` : palette.burst;
  const faceFill = palette.face ?? burstFill;

  const petals = Array.from({ length: PETAL_COUNT }, (_, i) => {
    const angle = (i * 2 * Math.PI) / PETAL_COUNT;
    return {
      cx: CX + PETAL_ORBIT * Math.cos(angle),
      cy: CY + PETAL_ORBIT * Math.sin(angle),
    };
  });

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      className={className}
      style={earned ? undefined : { opacity: 0.45 }}
    >
      {isPrismatic && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {PRISMATIC_STOPS.map((stop, i) => (
              <stop
                key={stop}
                offset={`${(i / (PRISMATIC_STOPS.length - 1)) * 100}%`}
                stopColor={stop}
              />
            ))}
          </linearGradient>
        </defs>
      )}

      {/* Ribbon tails */}
      <polygon points={points(RIBBON_LEFT)} fill={palette.ribbonShade} />
      <polygon points={points(mirror(RIBBON_LEFT))} fill={palette.ribbon} />

      {/* Petal ring, with a solid disc behind so the scallops read as one shape */}
      {petals.map((p, i) => (
        <circle
          key={i}
          data-testid="rosette-petal"
          cx={p.cx}
          cy={p.cy}
          r={PETAL_RADIUS}
          fill={burstFill}
        />
      ))}
      <circle cx={CX} cy={CY} r={PETAL_ORBIT} fill={burstFill} />

      {/* Light rim, then the centre face */}
      <circle cx={CX} cy={CY} r={41} fill={palette.disc} />
      <circle cx={CX} cy={CY} r={35} fill={faceFill} />

      {showNumber && (
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={42}
          fontWeight={700}
          fill={palette.numeral}
        >
          {tier}
        </text>
      )}
    </svg>
  );
}
