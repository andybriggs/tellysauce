"use client";

import useSWR from "swr";
import type { Title } from "@/types";

type DiscoverTitlesResponse = {
  titles: Title[];
};

export type DiscoverSource = "ai" | "tmdb" | "regional";

type Options = {
  timeframe?: string;
  source?: DiscoverSource;
  /** Required for source="regional"; null means "not resolved yet, don't fetch". */
  region?: string | null;
  initialData?: Title[];
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useDiscoverTitles(type?: "movie" | "tv", options?: Options) {
  const needsRegion = options?.source === "regional";

  let key: string | null = `/api/discover?type=${type ?? "movie"}`;

  if (options?.timeframe) {
    key += `&timeframe=${options.timeframe}`;
  }

  if (options?.source) {
    key += `&source=${options.source}`;
  }

  if (needsRegion) {
    // A null key makes SWR skip the request, so we never fire a throwaway
    // fetch for the default region before localStorage has been read.
    key = options?.region ? `${key}&region=${options.region}` : null;
  }

  const { data, isLoading, error } = useSWR<DiscoverTitlesResponse>(key, fetcher, {
    fallbackData: options?.initialData ? { titles: options.initialData } : undefined,
    revalidateOnMount: options?.initialData ? false : undefined,
  });

  return {
    titles: data?.titles ?? [],
    isLoading,
    error,
  };
}
