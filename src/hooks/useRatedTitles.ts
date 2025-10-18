"use client";

import useSWR from "swr";
import { useCallback, useState } from "react";
import type { Title } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useRatedTitles() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, error, isLoading, mutate, isValidating } = useSWR<Title[]>(
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
      setIsSubmitting(true);
      try {
        await fetch("/api/rated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId, mediaType, rating }),
        });
        await mutate(); // revalidate data
      } finally {
        setIsSubmitting(false);
      }
    },
    [mutate]
  );

  return {
    hasMounted: true,
    ratedTitles: data ?? [],
    rateTitle,
    isSaved,
    getRating,
    isLoading: isLoading || isValidating || isSubmitting,
    error,
  };
}
