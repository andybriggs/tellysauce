"use client";

import StarRating from "@/components/StarRating";
import { useRatedTitles } from "@/hooks/useRatedTitles";
import type { Title } from "@/types";
import WatchlistButton from "./WatchlistButton";
import useIsLoggedIn from "@/hooks/useIsLoggedIn";
import AuthButton from "./AuthButton";

export default function TitleActions({
  title,
}: {
  title: Omit<Title, "rating">;
}) {
  const { hasMounted, getRating } = useRatedTitles();
  const rating = hasMounted ? getRating(title.id) : 0;
  const isLoggedIn = useIsLoggedIn();

  return isLoggedIn ? (
    <div className="flex flex-col items-stretch sm:flex-row sm:items-center gap-4">
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
      />
    </div>
  ) : (
    <div className=" my-2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-[1px] shadow-2xl w-full max-w-md">
      <div className="bg-gray-900 rounded-3xl p-4 flex flex-col items-center text-center">
        <p className="text-gray-300 mb-2">
          Log in to rate and save shows to watchlist
        </p>
        <AuthButton />
      </div>
    </div>
  );
}
