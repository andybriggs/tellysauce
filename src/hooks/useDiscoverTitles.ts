"use client";

import useSWR from "swr";
import type { Title } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

type DiscoverTitlesResponse = {
  titles: Title[];
  isLoading: boolean;
  error: string | null;
};

export function useDiscoverTitles(
  type?: "movie" | "tv",
  options?: { timeframe?: string }
) {
  let key = `/api/discover?type=${type ?? "movie"}`;

  if (options?.timeframe) {
    key += `&timeframe=${options.timeframe}`;
  }

  const { data, isLoading, error } = useSWR<DiscoverTitlesResponse>(
    key,
    fetcher
  );

  return {
    titles: data?.titles ?? [],
    isLoading,
    error,
  };
}
