// components/MyShows.tsx
"use client";

import { useMyShows } from "../hooks/useMyShows";
import MyShowCard from "./MyShowCard";

const MyShows = () => {
  const { myShows } = useMyShows(); // shared state

  if (!myShows.length) {
    return (
      <p className="text-white m-8 text-center">
        You haven&apos;t added any shows yet.
      </p>
    );
  }

  console.log(myShows);

  return (
    <div className="m-8">
      <ul className="flex gap-4 overflow-auto">
        {myShows.map((show) => (
          <li key={show.id}>
            <MyShowCard show={show} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyShows;
