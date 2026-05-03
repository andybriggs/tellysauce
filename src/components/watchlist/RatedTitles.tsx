"use client";

import UserTitleList from "./UserTitleList";
import { useRatedTitles } from "@/hooks/useRatedTitles";
import { Layout } from "@/components/title/TitleList";

export default function RatedTitles({ layout = "carousel" }: { layout?: Layout }) {
  const { ratedTitles, rateTitle } = useRatedTitles();
  return (
    <UserTitleList
      layout={layout}
      items={ratedTitles}
      sectionTitle="⭐ My Rated Titles"
      emptyText="Search and rate some titles"
      viewAllHref="/all-rated-titles"
      gridHeading="⭐ My Rated Titles"
      rateTitle={rateTitle}
    />
  );
}
