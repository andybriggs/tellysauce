// components/ShowList.tsx
"use client";

import { ReactNode } from "react";

export type Layout = "carousel" | "grid";

export interface ShowListProps<T> {
  items: T[];
  layout?: Layout;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string | number;
}

// Note the `<T,>` generic on the arrow function to avoid JSX parsing issues.
const ShowList = <T,>({
  items,
  layout = "carousel",
  renderItem,
  getKey,
}: ShowListProps<T>) => {
  const isGrid = layout === "grid";
  const listClass = isGrid
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 py-4"
    : "flex items-stretch gap-4 overflow-auto py-4";

  return (
    <ul className={listClass}>
      {items.map((item) => (
        <li key={getKey(item)} className="h-auto flex-shrink-0 mb-8">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
};

export default ShowList;
