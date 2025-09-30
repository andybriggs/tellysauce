// app/hooks/useRatedShows.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Show } from "../types";
import {
  readVersioned,
  writeVersioned,
  parseEventValue,
} from "@/lib/versionedStorage";

const STORAGE_KEY = "myRatedShows";
const WATCHLIST_KEY = "watchList";

function clampRating(r: number) {
  return Math.max(0, Math.min(5, r));
}

function parseShowsLegacy(raw: string | null): Show[] {
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
      // noop
    }
  }, 0);
}

/** Remove an id from the watchlist (updates LS + notifies same-tab listeners) */
function removeFromWatchList(id: number) {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return;

    // Only operate on *current-version* value
    const current = (() => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.v) return parsed.data as unknown[];
      } catch {}
      return null;
    })();
    if (!Array.isArray(current)) return;

    const next = current.filter(
      (s: unknown) =>
        typeof s === "object" &&
        s !== null &&
        (s as Record<string, unknown>).id !== id
    );

    if (next.length !== current.length) {
      const newValue = JSON.stringify({ v: "2", data: next }); // or use APP_CACHE_VERSION if imported here
      localStorage.setItem(WATCHLIST_KEY, newValue);
      notifySameTabStorage(WATCHLIST_KEY, raw, newValue);
    }
  } catch {
    // swallow; malformed JSON shouldn't break rating UX
  }
}

export function useRatedShows() {
  const [hasMounted, setHasMounted] = useState(false);
  const [ratedShows, setRatedShows] = useState<Show[]>([]);

  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
    if (!hasMounted) return;

    let data = readVersioned<Show[]>(STORAGE_KEY, []);

    // Optional: one-time upgrade from legacy unversioned payload
    if (data.length === 0) {
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      const legacy = parseShowsLegacy(legacyRaw);
      if (legacy.length) {
        data = legacy;
        writeVersioned(STORAGE_KEY, data);
      }
    }

    setRatedShows(data);
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setRatedShows(parseEventValue<Show[]>(e.newValue, []));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hasMounted]);

  const isSaved = useCallback(
    (id?: number) =>
      typeof id === "number" ? ratedShows.some((s) => s.id === id) : false,
    [ratedShows]
  );

  /** Legacy: update rating only if the show already exists */
  const rateShow = useCallback((id: number, rating: number) => {
    setRatedShows((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, rating: clampRating(rating) } : s
      );
      writeVersioned(STORAGE_KEY, next);
      removeFromWatchList(id);
      return next;
    });
  }, []);

  /** NEW: get current rating (0 if not saved) */
  const getRating = useCallback(
    (id: number) => ratedShows.find((s) => s.id === id)?.rating ?? 0,
    [ratedShows]
  );

  /**
   * NEW: upsert helper used by the title page star rater.
   * - If the show exists → update rating
   * - If it doesn't → add it with the provided meta and rating
   */
  const rateShowAuto = useCallback(
    (meta: Omit<Show, "rating">, id: number, rating: number) => {
      setRatedShows((prev) => {
        const exists = prev.some((s) => s.id === id);
        const r = clampRating(rating);
        const next = exists
          ? prev.map((s) => (s.id === id ? { ...s, rating: r } : s))
          : [...prev, { ...meta, rating: r } as Show];

        writeVersioned(STORAGE_KEY, next);
        removeFromWatchList(id);

        return next;
      });
    },
    []
  );

  return {
    hasMounted,
    ratedShows,
    rateShow,
    isSaved,
    getRating,
    rateShowAuto,
  };
}
