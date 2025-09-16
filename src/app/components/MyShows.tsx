"use client";

import { useMyShows } from "../hooks/useMyShows";
import MyShowCard from "./MyShowCard";

const MyShows = () => {
  const { myShows, rateShow } = useMyShows();

  if (!myShows.length) {
    return (
      <div className="mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal mb-2">
          My Titles
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
      <h2 className="text-2xl text-white font-bold leading-normal mb-4">
        My Titles
      </h2>
      <ul className="flex items-stretch gap-4 overflow-auto py-4">
        {myShows.map((show) => (
          <li key={show.id} className="h-auto">
            <MyShowCard show={show} rateShow={rateShow} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyShows;
