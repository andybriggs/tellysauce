"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Section from "@/components/common/Section";
import EmptyStateCard from "@/components/common/EmptyStateCard";
import TitleList from "@/components/title/TitleList";
import TitleCard from "@/components/title/TitleCard";
import TitleGridFilters from "@/components/title/TitleGridFilters";
import type { Title } from "@/types";

type TypeFilter = "all" | "tv" | "movie";

const TYPE_PARAM = "type";
const GENRE_PARAM = "genre";

function parseTypeFilter(value: string | null): TypeFilter {
  return value === "tv" || value === "movie" ? value : "all";
}

export type UserTitleListProps = {
  layout?: "carousel" | "grid";
  items: Title[];
  sectionTitle: string;
  emptyText: string;
  viewAllHref: string;
  gridHeading: string;
  rateTitle?: (id: number, mediaType: "tv" | "movie", rating: number) => Promise<void>;
};

export default function UserTitleList({
  layout = "carousel",
  items,
  sectionTitle,
  emptyText,
  viewAllHref,
  gridHeading,
  rateTitle,
}: UserTitleListProps) {
  const isGrid = layout === "grid";

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [genreFilter, setGenreFilter] = useState("all");

  /**
   * Grid mode mirrors the filters into the query string so opening a title and
   * pressing back lands you on the same filtered view instead of resetting to
   * "All". `replaceState` rather than a router push - the filter is a view of
   * this page, not a history step of its own.
   *
   * Read in an effect rather than during render: the server render has no URL to
   * read, so seeding state from `window.location` would be a hydration mismatch.
   * Back out of a title page is a same-document navigation, hence `popstate`.
   */
  useEffect(() => {
    if (!isGrid) return;

    const applyFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setTypeFilter(parseTypeFilter(params.get(TYPE_PARAM)));
      setGenreFilter(params.get(GENRE_PARAM) ?? "all");
    };

    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, [isGrid]);

  const writeFiltersToUrl = useCallback(
    (type: TypeFilter, genre: string) => {
      if (!isGrid) return;
      // Unrelated params are preserved - this page is not the only thing that
      // may have written to the query string.
      const params = new URLSearchParams(window.location.search);
      if (type === "all") params.delete(TYPE_PARAM);
      else params.set(TYPE_PARAM, type);
      if (genre === "all") params.delete(GENRE_PARAM);
      else params.set(GENRE_PARAM, genre);

      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        query ? `${window.location.pathname}?${query}` : window.location.pathname
      );
    },
    [isGrid]
  );

  const filtered = useMemo(
    () =>
      items
        .filter((t) => typeFilter === "all" || t.type === typeFilter)
        .filter(
          (t) =>
            genreFilter === "all" || (t.genres ?? []).includes(genreFilter)
        ),
    [items, typeFilter, genreFilter]
  );

  function handleTypeChange(v: TypeFilter) {
    setTypeFilter(v);
    setGenreFilter("all");
    writeFiltersToUrl(v, "all");
  }

  function handleGenreChange(v: string) {
    setGenreFilter(v);
    writeFiltersToUrl(typeFilter, v);
  }

  // Grid mode: render full filter header + list directly (no Section wrapper)
  if (isGrid) {
    if (!items.length) {
      return (
        <div className="mb-8">
          <h2 className="text-2xl text-white font-bold leading-normal mb-2">
            {gridHeading}
          </h2>
          <EmptyStateCard>
            <p className="text-center text-sm font-medium">{emptyText}</p>
          </EmptyStateCard>
        </div>
      );
    }

    return (
      <div className="mb-12">
        <TitleGridFilters
          title={gridHeading}
          items={items}
          typeFilter={typeFilter}
          genreFilter={genreFilter}
          onTypeChange={handleTypeChange}
          onGenreChange={handleGenreChange}
          resultCount={filtered.length}
        />
        <TitleList
          items={filtered}
          layout="grid"
          renderItem={(t, l) => (
            <TitleCard title={t} rateTitle={rateTitle} fill={l === "grid"} />
          )}
        />
      </div>
    );
  }

  return (
    <Section
      title={sectionTitle}
      isEmpty={!items.length}
      showViewAll
      viewAllHref={viewAllHref}
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">{emptyText}</p>
        </EmptyStateCard>
      }
    >
      <TitleList
        items={items}
        layout="carousel"
        renderItem={(t, l) => (
          <TitleCard title={t} rateTitle={rateTitle} fill={l === "grid"} />
        )}
      />
    </Section>
  );
}
