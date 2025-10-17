"use client";

import StarRating from "@/components/StarRating";
import { useRatedTitles } from "@/hooks/useRatedTitles";
import type { Title } from "@/types";
import WatchlistButton from "./WatchlistButton";

export default function TitleActions({
  title,
}: {
  title: Omit<Title, "rating">;
}) {
  const { hasMounted, getRating, rateTitle } = useRatedTitles();

  const rating = hasMounted ? getRating(title.id) : 0;

  return (
    <div className="flex flex-col items-stretch sm:flex-row sm:items-center gap-4">
      {/* Only title watchlist button if NOT rated */}
      {rating === 0 && (
        <WatchlistButton
          title={{
            id: title.id,
            name: title.name,
            poster: title.poster,
            type: title.type,
            description: title.description,
          }}
        />
      )}

      <StarRating
        rating={rating}
        titleId={title.id}
        titleType={title.type as "tv" | "movie"}
        rateTitle={rateTitle}
      />
    </div>
  );
}
