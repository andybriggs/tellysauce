// app/components/TitleActions.tsx
"use client";

import StarRating from "@/components/StarRating";
import { useRatedShows } from "@/hooks/useRatedShows";
import type { Show } from "@/types";
import WatchlistButton from "./WatchlistButton";

export default function TitleActions({ show }: { show: Omit<Show, "rating"> }) {
  const { hasMounted, getRating, rateShowAuto } = useRatedShows();

  // until mounted we treat as unrated to avoid flicker; or hide the cluster entirely
  const rating = hasMounted ? getRating(show.id) : 0;

  return (
    <div className="flex flex-col items-stretch sm:flex-row sm:items-center gap-4">
      {/* Only show watchlist button if NOT rated */}
      {rating === 0 && (
        <WatchlistButton
          show={{
            id: show.id,
            name: show.name,
            poster: show.poster,
            type: show.type,
            description: show.description,
          }}
        />
      )}

      <StarRating
        rating={rating}
        showId={show.id}
        rateShow={(id, r) => {
          if (!hasMounted) return;
          // upsert rating; auto-add if missing (also hides watchlist after this)
          rateShowAuto(show, id, r);
        }}
      />
    </div>
  );
}
