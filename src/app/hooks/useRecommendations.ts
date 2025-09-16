import { useEffect, useState } from "react";
import { Recommendation } from "../types";

const RECOMMENDATIONS_KEY = "cachedRecommendations";

export function useGeminiRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(RECOMMENDATIONS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecommendations(parsed);
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  const getRecommendations = async (showList: { name: string; rating: number; }[]) => {
    if (!showList.length) return;

    setIsLoading(true);
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shows: showList }),
    });

    const data = await res.json();
    const recs = data.recommendations || [];

    setRecommendations(recs);
    localStorage.setItem(RECOMMENDATIONS_KEY, JSON.stringify(recs));
    setIsLoading(false);
  };

  return { recommendations, isLoading, getRecommendations };
}
