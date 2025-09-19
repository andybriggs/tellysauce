// app/hooks/useMyRatedShows.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Show } from "../types";

const STORAGE_KEY = "myRatedShows";

function clampRating(r: number) {
  return Math.max(0, Math.min(5, r));
}

function parseShows(raw: string | null): Show[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((show) => ({
      ...show,
      rating: typeof show.rating === "number" ? clampRating(show.rating) : 0,
    }));
  } catch {
    return [];
  }
}

export function useMyRatedShows() {
  const [hasMounted, setHasMounted] = useState(false);
  const [myRatedShows, setMyRatedShows] = useState<Show[]>([]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      const stored = localStorage.getItem(STORAGE_KEY);
      setMyRatedShows(parseShows(stored));
    }
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setMyRatedShows(parseShows(e.newValue));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hasMounted]);

  const isSaved = useCallback(
    (id?: number) =>
      typeof id === "number" ? myRatedShows.some((s) => s.id === id) : false,
    [myRatedShows]
  );

  const addShow = useCallback((show: Omit<Show, "rating">) => {
    setMyRatedShows((prev) => {
      if (prev.some((s) => s.id === show.id)) return prev;
      const newShow: Show = { ...show, rating: 0 };
      const next = [...prev, newShow];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeShow = useCallback((id: number) => {
    setMyRatedShows((prev) => {
      const next = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** Legacy: update rating only if the show already exists */
  const rateShow = useCallback((id: number, rating: number) => {
    setMyRatedShows((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, rating: clampRating(rating) } : s
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** NEW: get current rating (0 if not saved) */
  const getRating = useCallback(
    (id: number) => myRatedShows.find((s) => s.id === id)?.rating ?? 0,
    [myRatedShows]
  );

  /**
   * NEW: upsert helper used by the title page star rater.
   * - If the show exists → update rating
   * - If it doesn't → add it with the provided meta and rating
   */
  const rateShowAuto = useCallback(
    (meta: Omit<Show, "rating">, id: number, rating: number) => {
      setMyRatedShows((prev) => {
        const exists = prev.some((s) => s.id === id);
        const r = clampRating(rating);
        const next = exists
          ? prev.map((s) => (s.id === id ? { ...s, rating: r } : s))
          : [...prev, { ...meta, rating: r } as Show];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  return {
    // existing API (unchanged)
    hasMounted,
    myRatedShows,
    addShow,
    removeShow,
    rateShow,
    isSaved,
    getRating,
    rateShowAuto,
  };
}
