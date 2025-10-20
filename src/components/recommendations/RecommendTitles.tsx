"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import { useWatchList } from "@/hooks/useWatchList";
import EmptyRecommendations from "./EmptyRecommendations";
import RecommendationsHeader from "./RecommendationsHeader";
import RecommendationSkeletonGrid from "./RecommendationSkeletonGrid";
import RecommendationsGrid from "./RecommendationsGrid";
import { useRatedTitles } from "@/hooks/useRatedTitles";

type Seed = {
  title: string;
  overview?: string;
  genres?: string[];
  year?: number;
  type?: "movie" | "tv";
  external?: { tmdbId?: number; imdbId?: string | null };
};

type IdName = { id?: number; name?: string };

type Recommendation = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
};

function isIdName(v: unknown): v is IdName {
  return typeof v === "object" && v !== null;
}

function slugTitle(raw: string) {
  if (!raw) return "";
  let s = raw.replace(/\(\s*\d{4}\s*\)/g, "").replace(/\b\d{4}\b/g, "");
  s = s.split(":")[0].split(" - ")[0];
  s = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function buildKey(seed?: Seed) {
  if (!seed) {
    const v = process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3";
    return `profile:${v}`;
  }
  const t = seed.type ?? "unknown";
  const tmdb = seed.external?.tmdbId;
  if (tmdb) return `seed:${t}:${tmdb}`;
  return `seed:${t}:${slugTitle(seed.title)}`;
}

export default function RecommendTitles({
  seed,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cacheKey, // ignored now; we compute key deterministically to match backend
  autoRun = false,
  buttonLabel,
}: {
  seed?: Seed;
  cacheKey?: string;
  autoRun?: boolean;
  buttonLabel?: string;
}) {
  const { ratedTitles } = useRatedTitles();
  const { watchList } = useWatchList();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isSeedMode = !!seed;
  const key = useMemo(() => buildKey(seed), [seed]);

  const isCurrentTitleKnown = useMemo(() => {
    if (!isSeedMode) return true;

    const tmdbId = seed?.external?.tmdbId;
    const name = seed?.title ?? "";

    const ratedHit =
      Array.isArray(ratedTitles) &&
      ratedTitles.some((s) =>
        typeof tmdbId === "number" ? s.id === tmdbId : s.name === name
      );

    const watchHit =
      Array.isArray(watchList) &&
      watchList.some(
        (w) =>
          isIdName(w) &&
          (typeof tmdbId === "number" ? w.id === tmdbId : w.name === name)
      );

    return ratedHit || watchHit;
  }, [isSeedMode, seed, ratedTitles, watchList]);

  const hasTitles = useMemo(
    () => (isSeedMode ? true : (ratedTitles?.length ?? 0) > 0),
    [isSeedMode, ratedTitles?.length]
  );

  // Read any existing persisted set on mount/seed change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/recommendations?key=${encodeURIComponent(key)}`,
          {
            method: "GET",
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setRecommendations(
            data.items.map((i: Recommendation) => ({
              title: i.title,
              description: i.description ?? "",
              reason: i.reason ?? "",
              tags: Array.isArray(i.tags) ? i.tags : [],
            }))
          );
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      if (seed) {
        const watchListTitles =
          (Array.isArray(watchList) &&
            watchList
              .filter(isIdName)
              .map((w) => w.name)
              .filter(Boolean)) ||
          [];
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "seed",
            seed,
            watchList: watchListTitles,
          }),
        });
        if (!res.ok) {
          // (optionally surface error to UI)
          return;
        }
        const data = await res.json();
        const recs: Recommendation[] = Array.isArray(data?.recommendations)
          ? data.recommendations
          : [];
        setRecommendations(recs);
      } else {
        const titleList =
          (ratedTitles ?? []).map((s) => ({
            name: s.name,
            rating: s.rating,
          })) || [];
        const watchListTitles =
          (Array.isArray(watchList) &&
            watchList
              .filter(isIdName)
              .map((w) => w.name)
              .filter(Boolean)) ||
          [];
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "profile",
            titles: titleList,
            watchList: watchListTitles,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const recs: Recommendation[] = Array.isArray(data?.recommendations)
          ? data.recommendations
          : [];
        setRecommendations(recs);
      }
    } finally {
      setIsLoading(false);
    }
  }, [seed, ratedTitles, watchList]);

  useEffect(() => {
    if (autoRun && seed && !recommendations?.length && !isLoading) {
      handleClick();
    }
  }, [autoRun, seed, recommendations?.length, isLoading, handleClick]);

  if (isSeedMode && !isCurrentTitleKnown) return null;
  if (!hasTitles && !isSeedMode) return <EmptyRecommendations />;

  return (
    <section className="mt-6 rounded-3xl p-6 sm:p-8 md:p-10 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80 ring-1 ring-white/10">
      <RecommendationsHeader
        onClick={handleClick}
        isLoading={isLoading}
        canRun={hasTitles}
        hasResults={recommendations?.length > 0}
        label={buttonLabel ?? (seed ? "Find similar titles" : undefined)}
      />
      {isLoading ? (
        <RecommendationSkeletonGrid count={6} />
      ) : (
        <RecommendationsGrid items={recommendations} />
      )}
    </section>
  );
}
