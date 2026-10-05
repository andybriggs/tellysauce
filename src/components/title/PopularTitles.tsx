"use client";

import { Layout } from "./TitleList";
import Section from "@/components/common/Section";
import EmptyStateCard from "@/components/common/EmptyStateCard";
import TitleList from "./TitleList";
import { useDiscoverTitles } from "@/hooks/useDiscoverTitles";
import { useRegion } from "@/hooks/useRegion";
import { useState } from "react";
import { PillTabs } from "@/components/common/PillTabs";
import type { Title } from "@/types";

export default function PopularTitles({
  layout = "carousel",
  type = "movie",
  source,
  initialTitles,
  title: titleOverride,
}: {
  layout?: Layout;
  type?: "movie" | "tv";
  source?: "ai" | "regional";
  initialTitles?: Title[];
  /** Overrides the default heading — used by the region-scoped carousel. */
  title?: string;
}) {
  const [timeframe, setTimeframe] = useState<string>("recent");
  const isAi = source === "ai";
  const isRegional = source === "regional";
  const showTimeframeTabs = !isAi && !isRegional;
  const { region } = useRegion();
  const { titles } = useDiscoverTitles(type, {
    timeframe: showTimeframeTabs ? timeframe : undefined,
    source,
    region: isRegional ? region : undefined,
    initialData: initialTitles,
  });
  const isGrid = layout === "grid";

  const defaultTitle = isAi
    ? type === "movie"
      ? "✨ Todays AI picks: Movies"
      : "✨ Todays AI picks: TV shows"
    : type === "movie"
      ? "🔥 Popular movies"
      : "🔥 Popular TV shows";
  const title = titleOverride ?? defaultTitle;

  const pillTabs = showTimeframeTabs ? (
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
      showViewAll={!isGrid && showTimeframeTabs}
      emptyContent={
        <EmptyStateCard>
          <p className="text-center text-sm font-medium">
            {isAi
              ? "AI picks refresh daily — check back soon."
              : isRegional
                ? "Nothing airing in this region right now — try another."
                : "Loading..."}
          </p>
        </EmptyStateCard>
      }
      headerContentAfter={pillTabs}
    >
      <TitleList items={titles} layout={layout} showStatusOverlay />
    </Section>
  );
}
