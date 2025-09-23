// components/Watchlist.tsx
"use client";

import { Layout } from "./ShowList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import ShowList from "./ShowList";
import ShowCard from "./ShowCard";
import { useWatchList } from "../hooks/useWatchList";

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
      <ShowList
        items={watchList}
        layout={layout}
        getKey={(s) => s.id}
        renderItem={(s) => <ShowCard show={s} />}
      />
    </Section>
  );
}
