"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/solid";
import TitleList from "./TitleList";
import PaywallModal from "./PaywallModal";
import { useRatedTitles } from "@/hooks/useRatedTitles";
import { useWatchList } from "@/hooks/useWatchList";
import type { Title } from "@/types";

/* ---------- Types ---------- */

type Seed = {
  title: string;
  overview?: string;
  genres?: string[];
  year?: number;
  type?: "movie" | "tv";
  external?: { tmdbId?: number; imdbId?: string | null };
};

type IdName = { id?: number; name?: string };

type RecItem = {
  title: string;
  description?: string | null;
  reason?: string | null;
  tags?: string[] | null;
  year?: number | null;
  // POST response uses resolvedTmdbId + mediaType
  resolvedTmdbId?: number | null;
  mediaType?: string | null;
  // GET (cache) response uses suggestedTmdbId + suggestedMediaType
  suggestedTmdbId?: number | null;
  suggestedMediaType?: string | null;
  poster?: string | null;
};

/* ---------- Helpers ---------- */

function isIdName(v: unknown): v is IdName {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.name === "string" || typeof obj.id === "number";
}

function slugTitle(raw: string) {
  if (!raw) return "";
  let s = raw.replace(/\(\s*\d{4}\s*\)/g, "").replace(/\b\d{4}\b/g, "");
  s = s.split(":")[0].split(" - ")[0];
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildKey(seed?: Seed) {
  const v = process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3";
  if (!seed) return `profile:${v}`;
  const t = seed.type ?? "unknown";
  const tmdb = seed.external?.tmdbId;
  if (tmdb) return `seed:${t}:${tmdb}`;
  return `seed:${t}:${slugTitle(seed.title)}`;
}

function recToTitle(r: RecItem): Title | null {
  // POST response uses resolvedTmdbId; GET (cache) uses suggestedTmdbId
  const tmdbId = r.resolvedTmdbId ?? r.suggestedTmdbId ?? null;
  const mediaType = r.mediaType ?? r.suggestedMediaType ?? null;
  if (!tmdbId || !mediaType) return null;
  return {
    id: tmdbId,
    name: r.title,
    poster: r.poster ?? null,
    type: mediaType,
    rating: 0,
    description: r.description ?? null,
    year: typeof r.year === "number" ? r.year : undefined,
  };
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ---------- Component ---------- */

type GetResponse = {
  set: unknown | null;
  items: RecItem[];
};

type PostResponse = {
  recommendations?: RecItem[];
  key?: string;
  setId?: string;
};

export default function RecommendationsSection({
  seed,
  autoRun = false,
  buttonLabel,
}: {
  seed?: Seed;
  autoRun?: boolean;
  buttonLabel?: string;
}) {
  const { ratedTitles } = useRatedTitles();
  const { watchList } = useWatchList();

  const [titles, setTitles] = useState<Title[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<"free_exhausted" | "monthly_limit" | undefined>(undefined);

  const isSeedMode = !!seed;
  const key = useMemo(() => buildKey(seed), [seed]);

  // In seed mode, only show the section if the seed title is in the user's list
  const isCurrentTitleKnown = useMemo(() => {
    if (!isSeedMode) return true;
    const tmdbId = seed?.external?.tmdbId;
    const name = seed?.title ?? "";
    const ratedHit = Array.isArray(ratedTitles) &&
      ratedTitles.some((s) => (typeof tmdbId === "number" ? s.id === tmdbId : s.name === name));
    const watchHit = Array.isArray(watchList) &&
      watchList.some((w) => isIdName(w) && (typeof tmdbId === "number" ? w.id === tmdbId : w.name === name));
    return ratedHit || watchHit;
  }, [isSeedMode, seed, ratedTitles, watchList]);

  const hasTitles = isSeedMode ? true : (ratedTitles?.length ?? 0) > 0;

  // Load cached recommendations on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchJson<GetResponse>(`/api/recommendations?key=${encodeURIComponent(key)}`);
      if (!data || cancelled || !Array.isArray(data.items)) return;
      const mapped = data.items
        .map((item) => recToTitle(item))
        .filter((t): t is Title => t !== null);
      if (mapped.length > 0) setTitles(mapped);
    })();
    return () => { cancelled = true; };
  }, [key]);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      const watchListTitles = Array.isArray(watchList)
        ? watchList.filter(isIdName).map((w) => w.name).filter(Boolean)
        : [];

      const body = seed
        ? JSON.stringify({ mode: "seed", seed, watchList: watchListTitles })
        : JSON.stringify({
            mode: "profile",
            titles: (ratedTitles ?? []).map((s) => ({
              name: s.name,
              type: s.type,
              rating: s.rating,
            })),
            watchList: watchListTitles,
          });

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.status === 402) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setPaywallReason(body.error === "monthly_limit_reached" ? "monthly_limit" : "free_exhausted");
        setShowPaywall(true);
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as PostResponse;
      const mapped = (data.recommendations ?? [])
        .map((r) => recToTitle(r))
        .filter((t): t is Title => t !== null);
      setTitles(mapped);
    } finally {
      setIsLoading(false);
    }
  }, [seed, ratedTitles, watchList]);

  useEffect(() => {
    if (autoRun && seed && titles.length === 0 && !isLoading) {
      handleClick();
    }
  }, [autoRun, seed, titles.length, isLoading, handleClick]);

  if (isSeedMode && !isCurrentTitleKnown) return null;
  if (!hasTitles && !isSeedMode) return null;

  const label = buttonLabel ?? (seed ? "More like this" : "Smart picks for you");
  const hasResults = titles.length > 0;

  return (
    <>
      {showPaywall && (
        <PaywallModal
          reason={paywallReason}
          onClose={() => { setShowPaywall(false); setPaywallReason(undefined); }}
        />
      )}
      <section className="rounded-3xl p-6 sm:p-8 md:p-10 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80 ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-white text-3xl md:text-4xl font-semibold tracking-tight">
              {label}
            </h2>
            <p className="mt-1 text-white/70 text-sm md:text-base">
              {isSeedMode ? "Titles with similar tone, themes &amp; craft" : "Based on your rated titles"}
            </p>
          </div>

          <div className="group relative rounded-full p-[2px] bg-[conic-gradient(at_10%_10%,#7c3aed,#22d3ee,#f59e0b,#ec4899,#7c3aed)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]">
            <button
              type="button"
              onClick={handleClick}
              disabled={!hasTitles || isLoading}
              aria-live="polite"
              className={[
                "relative rounded-full px-6 md:px-8 py-3 md:py-4",
                "bg-slate-900/90 text-white font-semibold text-sm md:text-base tracking-wide",
                "flex items-center justify-center gap-2 md:gap-3",
                "shadow-lg ring-1 ring-white/10 backdrop-blur transition-[transform,background] active:scale-[0.99]",
                isLoading ? "cursor-wait" : "group-hover:bg-slate-900",
                !hasTitles ? "opacity-60" : "",
              ].join(" ")}
            >
              {isLoading ? (
                <ArrowPathIcon className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
              ) : (
                <SparklesIcon className="h-5 w-5 md:h-6 md:w-6" />
              )}
              <span className="hidden sm:inline">
                {hasResults ? "Refresh" : "Get"} Recommendations
              </span>
              <span className="sm:hidden">{hasResults ? "Refresh" : "Get"}</span>
            </button>
          </div>
        </div>

        {/* Carousel or loading skeleton */}
        {isLoading ? (
          <div className="mt-4 flex gap-4 overflow-hidden py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex-none w-48 h-64 rounded-xl bg-white/20 animate-pulse"
              />
            ))}
          </div>
        ) : hasResults ? (
          <TitleList items={titles} layout="carousel" showStatusOverlay />
        ) : null}
      </section>
    </>
  );
}
