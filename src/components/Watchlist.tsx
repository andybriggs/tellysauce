"use client";

import { Layout } from "./TitleList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import TitleList from "./TitleList";
import TitleCard from "./TitleCard";
import { useWatchList } from "@/hooks/useWatchList";

export default function Watchlist({
  layout = "carousel",
}: {
  layout?: Layout;
}) {
  const { watchList } = useWatchList();
  const isGrid = layout === "grid";

  return (
    <Section
      title="My Watchlist"
      isEmpty={!watchList.length}
      showViewAll={!isGrid}
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
        layout={layout}
        getKey={(t) => t.id}
        renderItem={(t) => <TitleCard title={t} />}
      />
    </Section>
  );
}
