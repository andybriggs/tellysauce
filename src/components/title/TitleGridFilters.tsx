"use client";

import { useMemo } from "react";
import { PillTabs } from "@/components/common/PillTabs";
import type { Title } from "@/types";

type TypeFilter = "all" | "tv" | "movie";

type Props = {
  title: string;
  items: Title[];
  typeFilter: TypeFilter;
  genreFilter: string;
  onTypeChange: (v: TypeFilter) => void;
  onGenreChange: (v: string) => void;
  resultCount: number;
};

const TYPE_OPTIONS = [
  { value: "all" as TypeFilter, label: "All" },
  { value: "tv" as TypeFilter, label: "TV" },
  { value: "movie" as TypeFilter, label: "Movies" },
];

const GENRE_PILL_BASE =
  "flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600";

const GENRE_PILL_ACTIVE =
  "bg-gradient-to-r from-pink-500 to-orange-400 text-zinc-50";

const GENRE_PILL_INACTIVE =
  "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white";

export default function TitleGridFilters({
  title,
  items,
  typeFilter,
  genreFilter,
  onTypeChange,
  onGenreChange,
  resultCount,
}: Props) {
  const availableGenres = useMemo(() => {
    const typeFiltered =
      typeFilter === "all" ? items : items.filter((t) => t.type === typeFilter);
    const all = typeFiltered.flatMap((t) => t.genres ?? []);
    return [...new Set(all)].sort();
  }, [items, typeFilter]);

  return (
    <div className="col-span-full mb-4">
      {/*
       * Desktop: one flex row — title | type pills | genre scroll | count
       * Mobile:  stacked column — title, type pills, genre scroll
       */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">

        {/* Section title */}
        <h2 className="text-2xl font-bold leading-normal text-white flex-shrink-0">
          {title}
        </h2>

        {/* Type filter */}
        <div className="flex-shrink-0">
          <PillTabs
            value={typeFilter}
            options={TYPE_OPTIONS}
            onChange={onTypeChange}
          />
        </div>

        {/* Genre scroll — takes remaining width on desktop */}
        {availableGenres.length > 0 && (
          <div className="min-w-0 flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex gap-2">
              {["all", ...availableGenres].map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => onGenreChange(genre)}
                  className={[
                    GENRE_PILL_BASE,
                    genre === genreFilter ? GENRE_PILL_ACTIVE : GENRE_PILL_INACTIVE,
                  ].join(" ")}
                >
                  {genre === "all" ? "All" : genre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Count — hidden on mobile to keep the stack clean */}
        <span className="hidden md:inline-block flex-shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
          {resultCount} {resultCount === 1 ? "title" : "titles"}
        </span>
      </div>
    </div>
  );
}
