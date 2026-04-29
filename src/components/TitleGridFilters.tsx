"use client";

import { useMemo } from "react";
import { PillTabs } from "./PillTabs";
import type { Title } from "@/types";

type TypeFilter = "all" | "tv" | "movie";

type Props = {
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

export default function TitleGridFilters({
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
    <div className="col-span-full space-y-3 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <PillTabs
          value={typeFilter}
          options={TYPE_OPTIONS}
          onChange={onTypeChange}
        />
        <span className="text-sm text-zinc-400 dark:text-zinc-500">
          {resultCount} {resultCount === 1 ? "title" : "titles"}
        </span>
      </div>

      {availableGenres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["all", ...availableGenres].map((genre) => {
            const active = genre === genreFilter;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => onGenreChange(genre)}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600",
                  active
                    ? "bg-gradient-to-r from-pink-500 to-orange-400 text-zinc-50"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50",
                ].join(" ")}
              >
                {genre === "all" ? "All genres" : genre}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
