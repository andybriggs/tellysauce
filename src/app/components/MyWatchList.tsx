"use client";

import Link from "next/link";
import MyShowCard from "./MyShowCard";
import { useWatchList } from "../hooks/useWatchList";

type Layout = "carousel" | "grid";

interface MyWatchListProps {
  layout?: Layout;
}

const MyWatchList = ({ layout = "carousel" }: MyWatchListProps) => {
  const { watchList } = useWatchList();

  const isEmpty = !watchList.length;
  const isGrid = layout === "grid";

  if (isEmpty) {
    return (
      <div className="mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal mb-2">
          My Watchlist
        </h2>
        <div className="flex items-stretch gap-4 overflow-auto py-4">
          <div className="flex flex-col justify-center items-center rounded-2xl bg-gray-800/60 border-2 border-dashed border-gray-600 text-gray-300 w-48 min-h-[12rem] flex-shrink-0 p-4">
            <p className="text-center text-sm font-medium">
              Add titles to your watchlist
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-baseline mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal">
          My Watchlist
        </h2>

        {!isGrid && (
          <Link
            href="/all-watchlist"
            className="text-sm text-gray-300 hover:text-white ml-3"
          >
            (View All)
          </Link>
        )}
      </div>

      <ul
        className={
          isGrid
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 py-4"
            : "flex items-stretch gap-4 overflow-auto py-4"
        }
      >
        {watchList.map((show) => (
          <li key={show.id} className="h-auto flex-shrink-0 mb-8">
            {/* Reuse the same card; no stars because no rateShow prop */}
            <MyShowCard show={show} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyWatchList;
