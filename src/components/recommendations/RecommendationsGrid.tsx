"use client";

import { Recommendation } from "@/types";
import RecommendationCard from "./RecommendationCard";

type Props = {
  items: Recommendation[];
};

export default function RecommendationsGrid({ items }: Props) {
  return (
    <ul className="flex items-stretch gap-4 overflow-auto py-4">
      {items.map((rec) => (
        <RecommendationCard
          key={rec.title}
          rec={rec}
        />
      ))}
    </ul>
  );
}
