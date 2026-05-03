"use client";

import UserTitleList from "./UserTitleList";
import { useWatchList } from "@/hooks/useWatchList";
import { Layout } from "@/components/title/TitleList";

export default function Watchlist({ layout = "carousel" }: { layout?: Layout }) {
  const { watchList } = useWatchList();
  return (
    <UserTitleList
      layout={layout}
      items={watchList}
      sectionTitle="🍿 My Watchlist"
      emptyText="Add titles to your watchlist"
      viewAllHref="/watchlist"
      gridHeading="🍿 My Watchlist"
    />
  );
}
