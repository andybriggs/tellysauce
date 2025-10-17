"use client";
import useSWR from "swr";
import { useCallback } from "react";
import type { Title } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

export function useRatedTitles() {
  const { data, error, isLoading, mutate } = useSWR<Title[]>(
    "/api/rated",
    fetcher
  );

  const isSaved = useCallback(
    (id?: number) =>
      typeof id === "number" ? (data ?? []).some((s) => s.id === id) : false,
    [data]
  );

  const getRating = useCallback(
    (id: number) => (data ?? []).find((s) => s.id === id)?.rating ?? 0,
    [data]
  );

  const rateTitle = useCallback(
    async (tmdbId: number, mediaType: "tv" | "movie", rating: number) => {
      await fetch("/api/rated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, mediaType, rating: clamp(rating) }),
      });
      mutate();
    },
    [mutate]
  );

  return {
    hasMounted: true,
    ratedTitles: data ?? [],
    rateTitle,
    isSaved,
    getRating,
    isLoading,
    error,
  };
}
