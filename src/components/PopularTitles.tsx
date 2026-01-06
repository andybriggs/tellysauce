"use client";

import { Layout } from "./TitleList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import TitleList from "./TitleList";
import TitleCard from "./TitleCard";
import { useDiscoverTitles } from "@/hooks/useDiscoverTitles";
import { useState } from "react";
import { PillTabs } from "./PillTabs";

export default function PopularTitles({
  layout = "carousel",
  type = "movie",
}: {
  layout?: Layout;
  type?: "movie" | "tv";
}) {
  const [timeframe, setTimeframe] = useState<string>("recent");
  const { titles } = useDiscoverTitles(type, { timeframe });
  const isGrid = layout === "grid";

  const title =
    type === "movie" ? "🔥 Movies people love" : "🔥 TV Shows people love";

  const pillTabs = (
    <PillTabs<string>
      value={timeframe}
      onChange={setTimeframe}
      options={[
        { value: "recent", label: "Recent" },
        { value: "all", label: "All time" },
      ]}
    />
  );

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
      headerContentAfter={pillTabs}
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
