import { useEffect, useState } from "react";
import { Recommendation } from "../types";
import {
  readVersioned,
  writeVersioned,
  parseEventValue,
} from "../lib/versionedStorage";

const RECOMMENDATIONS_KEY = "cachedRecommendations";

export function useGeminiRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If version mismatches or data is invalid, you'll just get []
    setRecommendations(
      readVersioned<Recommendation[]>(RECOMMENDATIONS_KEY, [])
    );
  }, []);

  // Optional: keep other tabs in sync if you trigger recommendations elsewhere
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECOMMENDATIONS_KEY) {
        setRecommendations(parseEventValue<Recommendation[]>(e.newValue, []));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const getRecommendations = async (
    showList: { name: string; rating: number }[],
    watchList: string[]
  ) => {
    if (!showList.length) return;

    setIsLoading(true);
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: showList, watchList }),
    });

    const data = await res.json();
    const recs: Recommendation[] = Array.isArray(data.recommendations)
      ? data.recommendations
      : [];

    setRecommendations(recs);
    writeVersioned(RECOMMENDATIONS_KEY, recs);
    setIsLoading(false);
  };

  return { recommendations, isLoading, getRecommendations };
}
