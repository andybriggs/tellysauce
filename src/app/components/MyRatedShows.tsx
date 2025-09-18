"use client";

import Link from "next/link";
import MyShowCard from "./MyShowCard";
import { useMyRatedShows } from "../hooks/useMyRatedShows";

type Layout = "carousel" | "grid";

interface MyRatedShowsProps {
  layout?: Layout;
}

const MyRatedShows = ({ layout = "carousel" }: MyRatedShowsProps) => {
  const { myRatedShows, rateShow } = useMyRatedShows();

  const isEmpty = !MyRatedShows.length;
  const isGrid = layout === "grid";

  if (isEmpty) {
    return (
      <div className="mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal mb-2">
          My Rated Shows
        </h2>
        <div className="flex items-stretch gap-4 overflow-auto py-4">
          <div className="flex flex-col justify-center items-center rounded-2xl bg-gray-800/60 border-2 border-dashed border-gray-600 text-gray-300 w-48 min-h-[12rem] flex-shrink-0 p-4 cursor-pointer hover:border-gray-400 transition">
            <p className="text-center text-sm font-medium">
              Search to add titles
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
          My Rated Shows
        </h2>

        {!isGrid && (
          <Link
            href="/all-rated-shows"
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
        {myRatedShows.map((show) => (
          <li key={show.id} className="h-auto flex-shrink-0 mb-8">
            <MyShowCard show={show} rateShow={rateShow} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyRatedShows;
