"use client";
import { ReactNode } from "react";
import SectionHeader from "./SectionHeader";

export default function Section({
  title,
  children,
  viewAllHref,
  showViewAll,
  isEmpty,
  emptyContent,
  headerContentAfter,
}: {
  title: string;
  children: ReactNode;
  viewAllHref?: string;
  showViewAll?: boolean;
  isEmpty: boolean;
  emptyContent: ReactNode;
  headerContentAfter?: ReactNode;
}) {
  if (isEmpty) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl text-white font-bold leading-normal mb-2">
          {title}
        </h2>
        {emptyContent}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <SectionHeader
        title={title}
        viewAllHref={viewAllHref}
        showViewAll={showViewAll}
        contentAfter={headerContentAfter}
      />
      {children}
    </div>
  );
}
