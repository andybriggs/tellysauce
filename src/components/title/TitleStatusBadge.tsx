"use client";

import { BookmarkIcon, StarIcon, CheckIcon } from "@heroicons/react/24/solid";
import useIsLoggedIn from "@/hooks/useIsLoggedIn";
import { useWatchList } from "@/hooks/useWatchList";
import { useRatedTitles } from "@/hooks/useRatedTitles";

type Props = {
  id: number;
  type: "tv" | "movie";
};

const TitleStatusBadge = ({ id, type }: Props) => {
  const isLoggedIn = useIsLoggedIn();
  const { isSaved: isInWatchlist } = useWatchList();
  const { isSaved: isRated } = useRatedTitles();

  if (!isLoggedIn) return null;

  const rated = isRated(id);
  const watchlisted = isInWatchlist(id, type);

  if (!rated && !watchlisted) return null;

  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full">
      {rated ? (
        <>
          <StarIcon className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <CheckIcon className="h-3 w-3 text-white flex-shrink-0" />
        </>
      ) : (
        <>
          <BookmarkIcon className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
          <CheckIcon className="h-3 w-3 text-white flex-shrink-0" />
        </>
      )}
    </div>
  );
};

export default TitleStatusBadge;
