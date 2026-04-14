"use client";

import useSWR from "swr";
import type { Title } from "@/types";

type DiscoverTitlesResponse = {
  titles: Title[];
  isLoading: boolean;
  error: string | null;
};

type Options = {
  timeframe?: string;
  source?: "ai" | "tmdb";
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useDiscoverTitles(type?: "movie" | "tv", options?: Options) {
  let key = `/api/discover?type=${type ?? "movie"}`;

  if (options?.timeframe) {
    key += `&timeframe=${options.timeframe}`;
  }

  if (options?.source) {
    key += `&source=${options.source}`;
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
