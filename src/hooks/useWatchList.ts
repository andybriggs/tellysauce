"use client";
import useSWR from "swr";
import { useCallback } from "react";
import type { Title, TitleMeta } from "@/types";
import { useBadgeCelebration } from "@/components/badges/BadgeProvider";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

type TitleInput = TitleMeta | Title;

export function useWatchList() {
  const { celebrate } = useBadgeCelebration();
  const { data, error, isLoading, mutate } = useSWR<Title[]>(
    "/api/watchlist",
    fetcher,
    { revalidateOnFocus: false }
  );

  // Safer: check by id + type (TMDB ids aren't globally unique across tv/movie)
  const isSaved = useCallback(
    (id?: number, type?: "tv" | "movie") => {
      const list = data ?? [];
      if (typeof id !== "number") return false;

      if (type) {
        return list.some((s) => s.id === id && s.type === type);
      }
      return list.some((s) => s.id === id);
    },
    [data]
  );

  // Flexible 'add': supports add(id, type) OR add(titleObj)
  const add = useCallback(
    async (input: number | TitleInput, mediaType?: "tv" | "movie") => {
      let tmdbId: number;
      let mt: "tv" | "movie";

      if (typeof input === "number") {
        if (!mediaType)
          throw new Error("mediaType required when calling add(id, mediaType)");
        tmdbId = input;
        mt = mediaType;
      } else {
        tmdbId = input.id;
        mt = input.type as "tv" | "movie";
      }

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, mediaType: mt }),
      });

      const body = (await res
        .json()
        .catch(() => ({}))) as { unlockedBadges?: string[] };
      if (body.unlockedBadges?.length) celebrate(body.unlockedBadges);

      mutate();
    },
    [mutate, celebrate]
  );

  const remove = useCallback(
    async (id: number, type: "tv" | "movie") => {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: id, mediaType: type }),
      });
      mutate();
    },
    [mutate]
  );

  const toggle = useCallback(
    async (title: TitleInput) => {
      if (isSaved(title.id, title.type as "tv" | "movie")) {
        await remove(title.id, title.type as "tv" | "movie");
      } else {
        // now valid: add accepts a Title/TitleMeta object
        await add(title);
      }
    },
    [add, remove, isSaved]
  );

  return {
    hasMounted: true,
    watchList: data ?? [],
    isSaved,
    add, // can use add(id, type) or add(titleObj)
    remove,
    toggle,
    isLoading,
    error,
  };
}
