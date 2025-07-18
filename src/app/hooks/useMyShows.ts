// hooks/useMyShows.ts
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
  // Lazy init so we only touch localStorage on client
  const [myShows, setMyShows] = useState<Show[]>(() =>
    typeof window === "undefined"
      ? []
      : parseShows(localStorage.getItem(STORAGE_KEY))
  );

  // Cross-tab sync (optional but nice)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setMyShows(parseShows(e.newValue));
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isSaved = useCallback(
    (id?: number) =>
      typeof id === "number" ? myShows.some((s) => s.id === id) : false,
    [myShows]
  );

  const addShow = useCallback((show: Show) => {
    setMyShows((prev) => {
      if (prev.some((s) => s.id === show.id)) return prev; // no dupes
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

  return { myShows, addShow, removeShow, isSaved };
}
