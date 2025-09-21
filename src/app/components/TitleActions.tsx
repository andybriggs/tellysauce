// app/components/TitleActions.tsx
"use client";

import StarRating from "@/app/components/StarRating";
import { useMyRatedShows } from "@/app/hooks/useMyRatedShows";
import type { Show } from "@/app/types";
import WatchlistButton from "./WatchlistButton";

export default function TitleActions({ show }: { show: Omit<Show, "rating"> }) {
  const { hasMounted, getRating, rateShowAuto } = useMyRatedShows();

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
            image: show.image,
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
