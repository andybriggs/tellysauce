"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSWRConfig } from "swr";
import useIsLoggedIn from "@/hooks/useIsLoggedIn";
import { BADGE_BY_KEY, type BadgeCategory, type BadgeDef } from "@/lib/badges";
import BadgeUnlockModal from "./BadgeUnlockModal";
import BadgeTrophyCase from "./BadgeTrophyCase";

type BadgeContextValue = {
  /** Queue badge keys for celebration. Safe to call with an empty array. */
  celebrate: (keys: string[]) => void;
};

// No-op default so hooks that call celebrate() work outside the provider
// (component tests render them in isolation).
const BadgeContext = createContext<BadgeContextValue>({ celebrate: () => {} });

export function useBadgeCelebration() {
  return useContext(BadgeContext);
}

export default function BadgeProvider({ children }: { children: ReactNode }) {
  const isLoggedIn = useIsLoggedIn();
  const { mutate } = useSWRConfig();
  const [queue, setQueue] = useState<string[]>([]);
  const [burstTotal, setBurstTotal] = useState(0);
  // Keys already handled this session, so a re-fetch cannot re-celebrate them
  const handled = useRef<Set<string>>(new Set());

  const celebrate = useCallback(
    (keys: string[]) => {
      const fresh = keys.filter(
        (k) => BADGE_BY_KEY[k] && !handled.current.has(k)
      );
      if (fresh.length === 0) return;
      fresh.forEach((k) => handled.current.add(k));

      // Only the highest new tier per category gets a modal. Established
      // accounts unlock several tiers at once on their first action; this is
      // what stops that becoming a stack of popups.
      const top = new Map<BadgeCategory, BadgeDef>();
      for (const key of fresh) {
        const badge = BADGE_BY_KEY[key];
        const current = top.get(badge.category);
        if (!current || badge.tier > current.tier) top.set(badge.category, badge);
      }
      const toShow = [...top.values()]
        .sort((a, b) => a.tier - b.tier)
        .map((b) => b.key);

      setQueue((q) => [...q, ...toShow]);
      setBurstTotal((t) => t + toShow.length);

      // Mark every awarded key seen, including the tiers we skip celebrating.
      fetch("/api/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: fresh }),
      })
        .then(() => mutate("/api/badges"))
        .catch(() => {});
    },
    [mutate]
  );

  // Catch-up: surface anything awarded but never celebrated (tab closed mid
  // request, navigation before the response landed).
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    fetch("/api/badges")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { badges?: { key: string; seen: boolean }[] } | null) => {
        if (cancelled || !data?.badges) return;
        const unseen = data.badges.filter((b) => !b.seen).map((b) => b.key);
        if (unseen.length > 0) celebrate(unseen);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, celebrate]);

  const dismiss = useCallback(() => {
    setQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) setBurstTotal(0);
      return next;
    });
  }, []);

  return (
    <BadgeContext.Provider value={{ celebrate }}>
      {children}
      <BadgeTrophyCase />
      {queue.length > 0 && (
        <BadgeUnlockModal
          key={queue[0]}
          badgeKey={queue[0]}
          onClose={dismiss}
          position={Math.max(1, burstTotal - queue.length + 1)}
          total={burstTotal}
        />
      )}
    </BadgeContext.Provider>
  );
}
