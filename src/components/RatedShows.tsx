"use client";

import { Layout } from "./ShowList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import ShowList from "./ShowList";
import ShowCard from "./ShowCard";
import { useRatedShows } from "@/hooks/useRatedShows";

export default function RatedShows({
  layout = "carousel",
}: {
  layout?: Layout;
}) {
  const { ratedShows, rateShow } = useRatedShows();
  const isGrid = layout === "grid";

  return (
    <Section
      title="My Rated Shows"
      isEmpty={!ratedShows?.length}
      showViewAll={!isGrid}
      viewAllHref="/all-rated-shows"
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">
            Search and rate some titles
          </p>
        </EmptyStateCard>
      }
    >
      <ShowList
        items={ratedShows}
        layout={layout}
        getKey={(s) => s.id}
        renderItem={(s) => <ShowCard show={s} rateShow={rateShow} />}
      />
    </Section>
  );
}
