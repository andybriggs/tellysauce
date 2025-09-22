"use client";

import { Recommendation } from "@/app/types";
import RecommendationCard from "./RecommendationCard";

type Props = {
  items: Recommendation[];
  onOpen: (title: string) => void;
};

export default function RecommendationsGrid({ items, onOpen }: Props) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((rec) => (
        <RecommendationCard
          key={rec.title} // Prefer a stable id if one exists
          rec={rec}
          onOpen={() => onOpen(rec.title)}
        />
      ))}
    </ul>
  );
}
