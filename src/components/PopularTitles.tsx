"use client";

import { Layout } from "./TitleList";
import Section from "./Section";
import EmptyStateCard from "./EmptyStateCard";
import TitleList from "./TitleList";
import { useDiscoverTitles } from "@/hooks/useDiscoverTitles";
import { useState } from "react";
import { PillTabs } from "./PillTabs";

export default function PopularTitles({
  layout = "carousel",
  type = "movie",
  source,
}: {
  layout?: Layout;
  type?: "movie" | "tv";
  source?: "ai";
}) {
  const [timeframe, setTimeframe] = useState<string>("recent");
  const isAi = source === "ai";
  const { titles } = useDiscoverTitles(type, {
    timeframe: isAi ? undefined : timeframe,
    source,
  });
  const isGrid = layout === "grid";

  const title = isAi
    ? type === "movie"
      ? "✨ AI picks: Movies"
      : "✨ AI picks: TV shows"
    : type === "movie"
      ? "🔥 Movies people love"
      : "🔥 TV Shows people love";

  const pillTabs = !isAi ? (
    <PillTabs<string>
      value={timeframe}
      onChange={setTimeframe}
      options={[
        { value: "recent", label: "Recent" },
        { value: "all", label: "All time" },
      ]}
    />
  ) : null;

  return (
    <Section
      title={title}
      isEmpty={!titles.length}
      showViewAll={!isGrid && !isAi}
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">
            {isAi ? "AI picks refresh daily — check back soon." : "Loading..."}
          </p>
        </EmptyStateCard>
      }
      headerContentAfter={pillTabs}
    >
      <TitleList items={titles} layout={layout} />
    </Section>
  );
}
