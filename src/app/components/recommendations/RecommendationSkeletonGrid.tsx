"use client";

type Props = { count?: number };

export default function RecommendationSkeletonGrid({ count = 6 }: Props) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="rounded-3xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 shadow-lg p-6 animate-pulse"
        >
          <div className="h-6 w-2/3 bg-white/20 rounded mb-4" />
          <div className="h-4 w-full bg-white/10 rounded mb-2" />
          <div className="h-4 w-5/6 bg-white/10 rounded mb-4" />
          <div className="h-3 w-24 bg-white/15 rounded" />
        </li>
      ))}
    </ul>
  );
}
