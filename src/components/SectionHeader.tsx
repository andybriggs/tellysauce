"use client";
import Link from "next/link";

export default function SectionHeader({
  title,
  viewAllHref,
  showViewAll,
}: {
  title: string;
  viewAllHref?: string;
  showViewAll?: boolean;
}) {
  return (
    <div className="flex items-baseline mb-4">
      <h2 className="text-2xl text-white font-bold leading-normal">{title}</h2>
      {showViewAll && viewAllHref && (
        <Link
          href={viewAllHref}
          className="text-sm text-gray-300 hover:text-white ml-3"
        >
          (View All)
        </Link>
      )}
    </div>
  );
}
