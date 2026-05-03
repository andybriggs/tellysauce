"use client";

import { useMemo, useState } from "react";
import type { Layout } from "@/components/title/TitleList";
import Section from "@/components/common/Section";
import EmptyStateCard from "@/components/common/EmptyStateCard";
import TitleList from "@/components/title/TitleList";
import TitleCard from "@/components/title/TitleCard";
import TitleGridFilters from "@/components/title/TitleGridFilters";
import type { Title } from "@/types";

type TypeFilter = "all" | "tv" | "movie";

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
          onGenreChange={setGenreFilter}
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
