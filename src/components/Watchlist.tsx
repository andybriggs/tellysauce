"use client";

import { useMemo, useState } from "react";
import { Layout } from "./TitleList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import TitleList from "./TitleList";
import TitleCard from "./TitleCard";
import TitleGridFilters from "./TitleGridFilters";
import { useWatchList } from "@/hooks/useWatchList";

type TypeFilter = "all" | "tv" | "movie";

export default function Watchlist({
  layout = "carousel",
}: {
  layout?: Layout;
}) {
  const { watchList } = useWatchList();
  const isGrid = layout === "grid";

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [genreFilter, setGenreFilter] = useState("all");

  const filtered = useMemo(
    () =>
      watchList
        .filter((t) => typeFilter === "all" || t.type === typeFilter)
        .filter(
          (t) =>
            genreFilter === "all" || (t.genres ?? []).includes(genreFilter)
        ),
    [watchList, typeFilter, genreFilter]
  );

  function handleTypeChange(v: TypeFilter) {
    setTypeFilter(v);
    setGenreFilter("all");
  }

  // Grid mode: render full filter header + list directly (no Section wrapper)
  if (isGrid) {
    if (!watchList.length) {
      return (
        <div className="mb-8">
          <h2 className="text-2xl text-white font-bold leading-normal mb-2">
            🍿 My Watchlist
          </h2>
          <EmptyStateCard>
            <p className="text-center text-sm font-medium">
              Add titles to your watchlist
            </p>
          </EmptyStateCard>
        </div>
      );
    }

    return (
      <div className="mb-12">
        <TitleGridFilters
          title="🍿 My Watchlist"
          items={watchList}
          typeFilter={typeFilter}
          genreFilter={genreFilter}
          onTypeChange={handleTypeChange}
          onGenreChange={setGenreFilter}
          resultCount={filtered.length}
        />
        <TitleList
          items={filtered}
          layout="grid"
          renderItem={(t, layout) => <TitleCard title={t} fill={layout === "grid"} />}
        />
      </div>
    );
  }

  return (
    <Section
      title="🍿 My Watchlist"
      isEmpty={!watchList.length}
      showViewAll
      viewAllHref="/watchlist"
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">
            Add titles to your watchlist
          </p>
        </EmptyStateCard>
      }
    >
      <TitleList
        items={watchList}
        layout="carousel"
        renderItem={(t, layout) => <TitleCard title={t} fill={layout === "grid"} />}
      />
    </Section>
  );
}
