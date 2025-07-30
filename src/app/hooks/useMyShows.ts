"use client";

import { useCallback, useEffect, useState } from "react";
import type { Show } from "../types";

const STORAGE_KEY = "myShows";

function parseShows(raw: string | null): Show[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useMyShows() {
  const [hasMounted, setHasMounted] = useState(false);
  const [myShows, setMyShows] = useState<Show[]>([]);

  // Detect client mount
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Load from localStorage only on client
  useEffect(() => {
    if (hasMounted) {
      const stored = localStorage.getItem(STORAGE_KEY);
      setMyShows(parseShows(stored));
    }
  }, [hasMounted]);

  // Cross-tab sync
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

  const addShow = useCallback((show: Show) => {
    setMyShows((prev) => {
      if (prev.some((s) => s.id === show.id)) return prev;
      const next = [...prev, show];
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

  return {
    hasMounted,
    myShows,
    addShow,
    removeShow,
    isSaved,
  };
}
