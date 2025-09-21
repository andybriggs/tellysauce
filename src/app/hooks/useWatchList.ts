"use client";

import { useCallback, useEffect, useState } from "react";
import type { Show } from "../types";

const STORAGE_KEY = "watchList";

type ShowInput = Omit<Show, "rating"> | Show;

function clampRating(r: number) {
  return Math.max(0, Math.min(5, r));
}

/** Convert unknown JSON element into a Show or null (if invalid) */
function normalizeToShow(u: unknown): Show | null {
  if (typeof u !== "object" || u === null) return null;
  const o = u as Record<string, unknown>;

  // id is required and must be number
  if (typeof o.id !== "number") return null;

  const id = o.id;

  const name = typeof o.name === "string" ? o.name : "";
  const image =
    typeof o.image === "string" || o.image === null
      ? (o.image as string | null)
      : null;
  const type = typeof o.type === "string" ? (o.type as string) : undefined;
  const description =
    typeof o.description === "string" || o.description === null
      ? (o.description as string | null)
      : null;

  const rating = typeof o.rating === "number" ? clampRating(o.rating) : 0;

  return { id, name, image, type, description, rating };
}

function parseShows(raw: string | null): Show[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((item: unknown) => normalizeToShow(item))
      .filter((s): s is Show => s !== null);

    return normalized;
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
    image: input.image ?? null,
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
    const stored = localStorage.getItem(STORAGE_KEY);
    setWatchList(parseShows(stored));
  }, [hasMounted]);

  // cross-tab sync
  useEffect(() => {
    if (!hasMounted) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setWatchList(parseShows(e.newValue));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setWatchList((prev) => {
      const next = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggle = useCallback((show: ShowInput) => {
    setWatchList((prev) => {
      const exists = prev.some((s) => s.id === show.id);
      const next = exists
        ? prev.filter((s) => s.id !== show.id)
        : [...prev, toShow(show)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { hasMounted, watchList, isSaved, add, remove, toggle };
}
