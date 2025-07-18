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
    <div className="m-8">
      <h2 className="text-2xl text-white font-bold leading-normal mb-4">
        My Shows
      </h2>
      <ul className="flex gap-4 overflow-auto pt-24">
        {myShows.map((show) => (
          <li key={show.id}>
            <MyShowCard show={show} removeShow={removeShow} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyShows;
