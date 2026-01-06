"use client";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { ReactNode } from "react";

export default function SectionHeader({
  title,
  viewAllHref,
  showViewAll,
  contentAfter,
}: {
  title: string;
  viewAllHref?: string;
  showViewAll?: boolean;
  contentAfter?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      {/* Left block */}
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-bold leading-normal text-white">
          {title}
        </h2>

        {contentAfter && (
          <div
            className="
              flex items-center
              w-full sm:w-auto
            "
          >
            {contentAfter}
          </div>
        )}
      </div>

      {/* Right action */}
      {showViewAll && viewAllHref && (
        <Link
          href={viewAllHref}
          className="
            ml-auto inline-flex items-center gap-1.5
            rounded-full border border-white/10
            bg-white/5 px-3 py-1.5
            text-sm font-medium text-white
            transition
            hover:bg-white/10 hover:border-white/20
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40
          "
        >
          <span>View all</span>
          <ChevronRightIcon className="h-4 w-4 opacity-80" />
        </Link>
      )}
    </div>
  );
}
