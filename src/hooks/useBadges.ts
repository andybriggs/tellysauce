"use client";

import useSWR from "swr";
import { BADGES, type BadgeCategory } from "@/lib/badges";

export type UserBadge = {
  key: string;
  awardedAt: string;
  seen: boolean;
};

export type BadgeProgress = Record<BadgeCategory, number>;

const NO_PROGRESS: BadgeProgress = { watchlist: 0, rated: 0, recs: 0 };

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useBadges() {
  const { data, error, isLoading } = useSWR<{
    badges: UserBadge[];
    progress: BadgeProgress;
  }>("/api/badges", fetcher, { revalidateOnFocus: false });

  const badges = data?.badges ?? [];
  const earnedKeys = new Set(badges.map((b) => b.key));

  return {
    badges,
    earnedKeys,
    progress: data?.progress ?? NO_PROGRESS,
    earnedCount: earnedKeys.size,
    totalCount: BADGES.length,
    isEarned: (key: string) => earnedKeys.has(key),
    awardedAt: (key: string) => badges.find((b) => b.key === key)?.awardedAt,
    isLoading,
    error,
  };
}
