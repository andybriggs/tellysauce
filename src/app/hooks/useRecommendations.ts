// hooks/useRecommendations.ts
import { useEffect, useState } from "react";
import { Recommendation } from "../types";
import {
  readVersioned,
  writeVersioned,
  parseEventValue,
} from "../lib/versionedStorage";

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

  // PROFILE mode (existing)
  const getFromProfile = async (
    showList: { name: string; rating: number }[],
    watchList: string[]
  ) => {
    if (!showList.length) return;
    setIsLoading(true);
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "profile", titles: showList, watchList }),
    });
    const data = await res.json();
    const recs: Recommendation[] = Array.isArray(data.recommendations)
      ? data.recommendations
      : [];
    setRecommendations(recs);
    writeVersioned(key, recs);
    setIsLoading(false);
  };

  // SEED mode (new)
  const getFromSeed = async (seed: Seed, watchList?: string[]) => {
    if (!seed?.title) return;
    setIsLoading(true);
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "seed", seed, watchList: watchList ?? [] }),
    });
    const data = await res.json();
    const recs: Recommendation[] = Array.isArray(data.recommendations)
      ? data.recommendations
      : [];
    setRecommendations(recs);
    writeVersioned(key, recs);
    setIsLoading(false);
  };

  return {
    recommendations,
    isLoading,
    getFromProfile,
    getFromSeed,
  };
}
