"use client";

import { Layout } from "./TitleList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import TitleList from "./TitleList";
import TitleCard from "./TitleCard";
import { useRatedTitles } from "@/hooks/useRatedTitles";

export default function RatedTitles({
  layout = "carousel",
}: {
  layout?: Layout;
}) {
  const { ratedTitles, rateTitle } = useRatedTitles();
  const isGrid = layout === "grid";

  return (
    <Section
      title="My Rated Titles"
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
      <TitleList
        items={ratedTitles}
        layout={layout}
        getKey={(s) => s.id}
        renderItem={(s) => <TitleCard title={s} rateTitle={rateTitle} />}
      />
    </Section>
  );
}
