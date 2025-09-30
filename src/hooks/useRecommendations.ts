// hooks/useRecommendations.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Recommendation } from "../types";
import {
  readVersioned,
  writeVersioned,
  parseEventValue,
} from "@/lib/versionedStorage";

type Seed = {
  title: string;
  overview?: string;
  genres?: string[];
  year?: number;
  type?: "movie" | "tv";
  external?: { tmdbId?: number; imdbId?: string | null };
};

const DEFAULT_KEY = "cachedRecommendations";

export function useGeminiRecommendations(cacheKey?: string) {
  const key = cacheKey ?? DEFAULT_KEY;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // avoid setting state after unmount
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // load cache for this key
  useEffect(() => {
    setRecommendations(readVersioned<Recommendation[]>(key, []));
  }, [key]);

  // keep tabs in sync for this key
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        setRecommendations(parseEventValue<Recommendation[]>(e.newValue, []));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  /** Shared requester with reactive auth on 401 */
  const requestRecommendations = async (payload: unknown) => {
    try {
      setIsLoading(true);

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        await signIn("google", { callbackUrl: window.location.href });
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Recommend request failed: ${res.status} ${res.statusText} ${text}`
        );
      }

      const data = await res.json();
      const recs: Recommendation[] = Array.isArray(data.recommendations)
        ? data.recommendations
        : [];

      if (!mountedRef.current) return;
      setRecommendations(recs);
      writeVersioned(key, recs);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  // PROFILE mode (existing)
  const getFromProfile = async (
    showList: { name: string; rating: number }[],
    watchList: string[]
  ) => {
    if (!showList.length) return;
    await requestRecommendations({
      mode: "profile",
      titles: showList,
      watchList,
    });
  };

  // SEED mode (new)
  const getFromSeed = async (seed: Seed, watchList?: string[]) => {
    if (!seed?.title) return;
    await requestRecommendations({
      mode: "seed",
      seed,
      watchList: watchList ?? [],
    });
  };

  return {
    recommendations,
    isLoading,
    getFromProfile,
    getFromSeed,
  };
}
