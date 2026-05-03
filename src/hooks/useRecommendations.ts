"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildRecKey } from "@/lib/recs";
import type { SeedInput, Title } from "@/types";

/* ---------- Types ---------- */

export type RecItem = {
  title: string;
  description?: string | null;
  reason?: string | null;
  tags?: string[] | null;
  year?: number | null;
  // POST response uses resolvedTmdbId + mediaType
  resolvedTmdbId?: number | null;
  mediaType?: string | null;
  // GET (cache) response uses suggestedTmdbId + suggestedMediaType
  suggestedTmdbId?: number | null;
  suggestedMediaType?: string | null;
  poster?: string | null;
};

type GetResponse = {
  set: unknown | null;
  items: RecItem[];
};

type PostResponse = {
  recommendations?: RecItem[];
  key?: string;
  setId?: string;
};

type GenerateArgs = {
  ratedTitles?: { name: string; type: string | undefined; rating: number }[] | null;
  watchList?: unknown[] | null;
};

/* ---------- Helpers ---------- */

export function recToTitle(r: RecItem): Title | null {
  const tmdbId = r.resolvedTmdbId ?? r.suggestedTmdbId ?? null;
  const mediaType = r.mediaType ?? r.suggestedMediaType ?? null;
  if (!tmdbId || !mediaType) return null;
  return {
    id: tmdbId,
    name: r.title,
    poster: r.poster ?? null,
    type: mediaType,
    rating: 0,
    description: r.description ?? null,
    year: typeof r.year === "number" ? r.year : undefined,
  };
}

function isIdName(v: unknown): v is { id?: number; name?: string } {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.name === "string" || typeof obj.id === "number";
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ---------- Hook ---------- */

export function useRecommendations({ seed }: { seed?: SeedInput } = {}) {
  const [titles, setTitles] = useState<Title[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [paywallError, setPaywallError] = useState<"free_exhausted" | "monthly_limit" | null>(null);

  const key = useMemo(
    () => buildRecKey(seed ? { mode: "seed", seed } : { mode: "profile" }),
    [seed]
  );

  // Load cached recommendations on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchJson<GetResponse>(`/api/recommendations?key=${encodeURIComponent(key)}`);
      if (!data || cancelled || !Array.isArray(data.items)) return;
      const mapped = data.items
        .map((item) => recToTitle(item))
        .filter((t): t is Title => t !== null);
      if (mapped.length > 0) setTitles(mapped);
    })();
    return () => { cancelled = true; };
  }, [key]);

  const generate = useCallback(async ({ ratedTitles, watchList }: GenerateArgs = {}) => {
    setIsLoading(true);
    try {
      const watchListTitles = Array.isArray(watchList)
        ? watchList.filter(isIdName).map((w) => w.name).filter(Boolean)
        : [];

      const body = seed
        ? JSON.stringify({ mode: "seed", seed, watchList: watchListTitles })
        : JSON.stringify({
            mode: "profile",
            titles: (ratedTitles ?? []).map((s) => ({
              name: s.name,
              type: s.type,
              rating: s.rating,
            })),
            watchList: watchListTitles,
          });

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.status === 402) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setPaywallError(json.error === "monthly_limit_reached" ? "monthly_limit" : "free_exhausted");
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as PostResponse;
      const mapped = (data.recommendations ?? [])
        .map((r) => recToTitle(r))
        .filter((t): t is Title => t !== null);
      setTitles(mapped);
    } finally {
      setIsLoading(false);
    }
  }, [seed]);

  const clearPaywall = useCallback(() => setPaywallError(null), []);

  return { titles, isLoading, paywallError, clearPaywall, generate, key };
}
