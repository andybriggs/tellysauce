"use client";

import { useCallback, useEffect, useState } from "react";
import type { Show } from "../types";

const STORAGE_KEY = "myShows";

function parseShows(raw: string | null): Show[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((show) => ({
      ...show,
      rating: typeof show.rating === "number" ? show.rating : 0,
    }));
  } catch {
    return [];
  }
}

export function useMyShows() {
  const [hasMounted, setHasMounted] = useState(false);
  const [myShows, setMyShows] = useState<Show[]>([]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      const stored = localStorage.getItem(STORAGE_KEY);
      setMyShows(parseShows(stored));
    }
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setMyShows(parseShows(e.newValue));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hasMounted]);

  const isSaved = useCallback(
    (id?: number) =>
      typeof id === "number" ? myShows.some((s) => s.id === id) : false,
    [myShows]
  );

  const addShow = useCallback((show: Omit<Show, "rating">) => {
    setMyShows((prev) => {
      if (prev.some((s) => s.id === show.id)) return prev;
      const newShow: Show = { ...show, rating: 0 };
      const next = [...prev, newShow];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeShow = useCallback((id: number) => {
    setMyShows((prev) => {
      const next = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const rateShow = useCallback((id: number, rating: number) => {
    setMyShows((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, rating: Math.max(0, Math.min(5, rating)) } : s
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    hasMounted,
    myShows,
    addShow,
    removeShow,
    rateShow,
    isSaved,
  };
}
