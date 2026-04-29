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

  // Grid mode: render full filter header + list directly (no Section wrapper)
  if (isGrid) {
    if (!ratedTitles.length) {
      return (
        <div className="mb-8">
          <h2 className="text-2xl text-white font-bold leading-normal mb-2">
            ⭐ My Rated Titles
          </h2>
          <EmptyStateCard>
            <p className="text-center text-sm font-medium">
              Search and rate some titles
            </p>
          </EmptyStateCard>
        </div>
      );
    }

    return (
      <div className="mb-12">
        <TitleGridFilters
          title="⭐ My Rated Titles"
          items={ratedTitles}
          typeFilter={typeFilter}
          genreFilter={genreFilter}
          onTypeChange={handleTypeChange}
          onGenreChange={setGenreFilter}
          resultCount={filtered.length}
        />
        <TitleList
          items={filtered}
          layout="grid"
          renderItem={(t, layout) => <TitleCard title={t} rateTitle={rateTitle} fill={layout === "grid"} />}
        />
      </div>
    );
  }

  return (
    <Section
      title="⭐ My Rated Titles"
      isEmpty={!ratedTitles?.length}
      showViewAll
      viewAllHref="/all-rated-titles"
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">
            Search and rate some titles
          </p>
        </EmptyStateCard>
      }
    >
      <TitleList
        items={ratedTitles}
        layout="carousel"
        renderItem={(t, layout) => <TitleCard title={t} rateTitle={rateTitle} fill={layout === "grid"} />}
      />
    </Section>
  );
}
