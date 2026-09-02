"use client";

import BadgeRosette from "./BadgeRosette";
import { useBadges } from "@/hooks/useBadges";
import { badgesFor, CATEGORY_LABELS, type BadgeCategory } from "@/lib/badges";

type Props = {
  category: BadgeCategory;
};

const formatDate = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

/** One category's five tiers, rendered as a row inside the trophy case. */
export default function BadgeShelf({ category }: Props) {
  const { isEarned, awardedAt, progress } = useBadges();

  const tiers = badgesFor(category);
  const earnedCount = tiers.filter((b) => isEarned(b.key)).length;
  const count = progress[category];

  return (
    <section className="mb-7" data-testid={`badge-shelf-${category}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          {CATEGORY_LABELS[category]}
        </h3>
        <span className="text-xs text-gray-500 shrink-0">
          {earnedCount} / {tiers.length}
        </span>
      </div>

      <ul className="grid grid-cols-5 gap-1.5">
        {tiers.map((badge) => {
          const earned = isEarned(badge.key);
          const date = earned ? formatDate(awardedAt(badge.key)) : null;

          return (
            <li
              key={badge.key}
              className={[
                "flex flex-col items-center text-center rounded-xl px-1 py-2 border",
                earned
                  ? "bg-white/10 border-white/10"
                  : "bg-white/[0.03] border-white/5",
              ].join(" ")}
              title={
                earned
                  ? `${badge.name} - ${badge.unlockText}`
                  : `${badge.name} - reach ${badge.threshold}`
              }
            >
              <BadgeRosette tier={badge.tier} earned={earned} size={44} />
              <span
                className={[
                  "mt-1 text-[10px] leading-tight font-medium",
                  earned ? "text-white" : "text-gray-500",
                ].join(" ")}
              >
                {badge.name}
              </span>
              <span className="mt-0.5 text-[10px] text-gray-500">
                {earned
                  ? date ?? "Earned"
                  : `${Math.min(count, badge.threshold)}/${badge.threshold}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
