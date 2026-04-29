"use client";

import { useMemo, useState } from "react";
import { Layout } from "./TitleList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import TitleList from "./TitleList";
import TitleCard from "./TitleCard";
import TitleGridFilters from "./TitleGridFilters";
import { useRatedTitles } from "@/hooks/useRatedTitles";

type TypeFilter = "all" | "tv" | "movie";

export default function RatedTitles({
  layout = "carousel",
}: {
  layout?: Layout;
}) {
  const { ratedTitles, rateTitle } = useRatedTitles();
  const isGrid = layout === "grid";

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [genreFilter, setGenreFilter] = useState("all");

  const filtered = useMemo(
    () =>
      ratedTitles
        .filter((t) => typeFilter === "all" || t.type === typeFilter)
        .filter(
          (t) =>
            genreFilter === "all" || (t.genres ?? []).includes(genreFilter)
        ),
    [ratedTitles, typeFilter, genreFilter]
  );

  function handleTypeChange(v: TypeFilter) {
    setTypeFilter(v);
    setGenreFilter("all");
  }

  return (
    <Section
      title="⭐ My Rated Titles"
      isEmpty={!ratedTitles?.length}
      showViewAll={!isGrid}
      viewAllHref="/all-rated-titles"
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">
            Search and rate some titles
          </p>
        </EmptyStateCard>
      }
    >
      {isGrid && (
        <TitleGridFilters
          items={ratedTitles}
          typeFilter={typeFilter}
          genreFilter={genreFilter}
          onTypeChange={handleTypeChange}
          onGenreChange={setGenreFilter}
          resultCount={filtered.length}
        />
      )}
      <TitleList
        items={isGrid ? filtered : ratedTitles}
        layout={layout}
        renderItem={(t, layout) => <TitleCard title={t} rateTitle={rateTitle} fill={layout === "grid"} />}
      />
    </Section>
  );
}
