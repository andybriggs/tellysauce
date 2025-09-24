"use client";

import { Recommendation } from "@/app/types";
import RecommendationCard from "./RecommendationCard";

type Props = {
  items: Recommendation[];
};

export default function RecommendationsGrid({ items }: Props) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((rec) => (
        <RecommendationCard
          key={rec.title} // Prefer a stable id if one exists
          rec={rec}
        />
      ))}
    </ul>
  );
}
