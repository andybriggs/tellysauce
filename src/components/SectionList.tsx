"use client";

import Link from "next/link";
import { ReactNode } from "react";

type Layout = "carousel" | "grid";

interface SectionListProps<T> {
  title: string;
  items: T[];
  layout?: Layout;
  viewAllHref?: string; // only shows when layout !== "grid"
  emptyState: ReactNode; // what to render when items is empty
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string | number;
}

export default function SectionList<T>({
  title,
  items,
  layout = "carousel",
  viewAllHref,
  emptyState,
  renderItem,
  getKey,
}: SectionListProps<T>) {
  const isEmpty = !items || items.length === 0;
  const isGrid = layout === "grid";

  if (isEmpty) {
    return (
      <div className="mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal mb-2">
          {title}
        </h2>
        <div className="flex items-stretch gap-4 overflow-auto py-4">
          {emptyState}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-baseline mb-4">
        <h2 className="text-2xl text-white font-bold leading-normal">
          {title}
        </h2>

        {!isGrid && viewAllHref && (
          <Link
            href={viewAllHref}
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
        {items.map((item) => (
          <li key={getKey(item)} className="h-auto flex-shrink-0 mb-8">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
