"use client";

import { Layout } from "./TitleList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import TitleList from "./TitleList";
import TitleCard from "./TitleCard";
import { useDiscoverTitles } from "@/hooks/useDiscoverTitles";

export default function PopularTitles({
  layout = "carousel",
  type = "movie",
}: {
  layout?: Layout;
  type?: "movie" | "tv";
}) {
  const { titles } = useDiscoverTitles(type);
  const isGrid = layout === "grid";

  const title =
    type === "movie" ? "🔥 Movies people love" : "🔥 TV Shows people love";

  return (
    <Section
      title={title}
      isEmpty={!titles.length}
      showViewAll={!isGrid}
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">Loading...</p>
        </EmptyStateCard>
      }
    >
      <TitleList
        items={titles}
        layout={layout}
        getKey={(t) => t.id}
        renderItem={(t) => <TitleCard title={t} />}
      />
    </Section>
  );
}
