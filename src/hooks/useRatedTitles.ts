"use client";

import useSWR from "swr";
import { useCallback, useState } from "react";
import type { Title } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

export function useRatedTitles() {
  const [submittingIds, setSubmittingIds] = useState<Set<number>>(new Set());

  const {
    data,
    error,
    isLoading: swrLoading,
    isValidating,
    mutate,
  } = useSWR<Title[]>("/api/rated", fetcher);

  const isSaved = useCallback(
    (id?: number) =>
      typeof id === "number" ? (data ?? []).some((s) => s.id === id) : false,
    [data]
  );

  const getRating = useCallback(
    (id: number) => (data ?? []).find((s) => s.id === id)?.rating ?? 0,
    [data]
  );

  const isSubmittingId = useCallback(
    (id: number) => submittingIds.has(id),
    [submittingIds]
  );

  const rateTitle = useCallback(
    async (tmdbId: number, mediaType: "tv" | "movie", rating: number) => {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.add(tmdbId);
        return next;
      });

      try {
        await fetch("/api/rated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdbId,
            mediaType,
            rating: clamp(rating),
          }),
        });

        await mutate();
      } finally {
        setSubmittingIds((prev) => {
          const next = new Set(prev);
          next.delete(tmdbId);
          return next;
        });
      }
    },
    [mutate]
  );

  const isSubmittingAny = submittingIds.size > 0;
  const isLoading = swrLoading || isValidating || isSubmittingAny;

  return {
    hasMounted: true,
    ratedTitles: data ?? [],
    rateTitle,
    isSaved,
    getRating,
    isLoading,
    error,
    isSubmittingId,
  };
}
