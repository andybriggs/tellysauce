// app/hooks/useMyRatedShows.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Show } from "../types";

const STORAGE_KEY = "myRatedShows";
const WATCHLIST_KEY = "watchList";

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

/** Defer a synthetic storage event so other hooks update AFTER this render commits */
function notifySameTabStorage(
  key: string,
  oldValue: string | null,
  newValue: string | null
) {
  // Defer to next macrotask to avoid "setState while rendering a different component"
  setTimeout(() => {
    try {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          oldValue,
          newValue,
          storageArea: localStorage,
          url: window.location.href,
        })
      );
    } catch {
      // noop — we don't want UX to break if this throws
    }
  }, 0);
}

/** Remove an id from the watchlist (updates LS + notifies same-tab listeners) */
function removeFromWatchList(id: number) {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const next = parsed.filter(
      (s: unknown) =>
        typeof s === "object" &&
        s !== null &&
        (s as Record<string, any>).id !== id
    );

    if (next.length !== parsed.length) {
      const newValue = JSON.stringify(next);
      localStorage.setItem(WATCHLIST_KEY, newValue);
      // Notify same-tab listeners after commit
      notifySameTabStorage(WATCHLIST_KEY, raw, newValue);
    }
  } catch {
    // swallow; malformed JSON shouldn't break rating UX
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

      // ensure it's no longer on the watchlist whenever a rating happens
      removeFromWatchList(id);

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

        // remove from watchlist when a show gets (up)rated/added via rating
        removeFromWatchList(id);

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
