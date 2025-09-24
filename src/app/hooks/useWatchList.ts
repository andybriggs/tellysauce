"use client";

import { useCallback, useEffect, useState } from "react";
import type { Show } from "../types";
import {
  readVersioned,
  writeVersioned,
  parseEventValue,
} from "../lib/versionedStorage";

const STORAGE_KEY = "watchList";

type ShowInput = Omit<Show, "rating"> | Show;

function clampRating(r: number) {
  return Math.max(0, Math.min(5, r));
}

function normalizeToShow(u: unknown): Show | null {
  if (typeof u !== "object" || u === null) return null;
  const o = u as Record<string, unknown>;
  if (typeof o.id !== "number") return null;

  const id = o.id;
  const name = typeof o.name === "string" ? o.name : "";
  const poster =
    typeof o.poster === "string" || o.poster === null
      ? (o.poster as string | null)
      : null;
  const type = typeof o.type === "string" ? (o.type as string) : undefined;
  const description =
    typeof o.description === "string" || o.description === null
      ? (o.description as string | null)
      : null;

  const rating = typeof o.rating === "number" ? clampRating(o.rating) : 0;

  return { id, name, poster, type, description, rating };
}

function parseShowsLegacy(raw: string | null): Show[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: unknown) => normalizeToShow(item))
      .filter((s): s is Show => s !== null);
  } catch {
    return [];
  }
}

/** Ensure we always store a proper Show (rating defaults to 0 if missing) */
function toShow(input: ShowInput): Show {
  const rating =
    "rating" in input && typeof input.rating === "number"
      ? clampRating(input.rating)
      : 0;

  return {
    id: input.id,
    name: input.name,
    poster: input.poster ?? null,
    type: input.type,
    description: input.description ?? null,
    rating,
  };
}

export function useWatchList() {
  const [hasMounted, setHasMounted] = useState(false);
  const [watchList, setWatchList] = useState<Show[]>([]);

  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
    if (!hasMounted) return;

    // Try to read versioned payload. If not versioned or mismatched, this returns [].
    let data = readVersioned<Show[]>(STORAGE_KEY, []);

    // Optional: one-time upgrade path from your legacy unversioned array.
    // If you want to *destroy* instead of upgrading, delete this block.
    if (data.length === 0) {
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      const legacy = parseShowsLegacy(legacyRaw);
      if (legacy.length) {
        data = legacy;
        writeVersioned(STORAGE_KEY, data);
      }
    }

    setWatchList(data);
  }, [hasMounted]);

  // cross-tab sync (only accept current-version envelopes)
  useEffect(() => {
    if (!hasMounted) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setWatchList(parseEventValue<Show[]>(e.newValue, []));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hasMounted]);

  const isSaved = useCallback(
    (id?: number) =>
      typeof id === "number" ? watchList.some((s) => s.id === id) : false,
    [watchList]
  );

  const add = useCallback((show: ShowInput) => {
    setWatchList((prev) => {
      if (prev.some((s) => s.id === show.id)) return prev;
      const next = [...prev, toShow(show)];
      writeVersioned(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setWatchList((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeVersioned(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggle = useCallback((show: ShowInput) => {
    setWatchList((prev) => {
      const exists = prev.some((s) => s.id === show.id);
      const next = exists
        ? prev.filter((s) => s.id !== show.id)
        : [...prev, toShow(show)];
      writeVersioned(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { hasMounted, watchList, isSaved, add, remove, toggle };
}
