// components/MyShows.tsx
"use client";

import { useMyShows } from "../hooks/useMyShows";
import MyShowCard from "./MyShowCard";

const MyShows = () => {
  const { myShows, removeShow } = useMyShows(); // shared state

  if (!myShows.length) {
    return (
      <p className="text-white m-8 text-center">
        You haven&apos;t added any shows yet.
      </p>
    );
  }

  return (
    <div className="mb-4">
      <h2 className="text-2xl text-white font-bold leading-normal mb-4">
        My Show
      </h2>
      <ul className="flex items-stretch gap-4 overflow-auto py-4">
        {myShows.map((show) => (
          <li key={show.id} className="h-auto">
            <MyShowCard show={show} removeShow={removeShow} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyShows;
