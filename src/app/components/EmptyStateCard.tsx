"use client";
import { ReactNode } from "react";

export default function EmptyStateCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-stretch gap-4 overflow-auto py-4">
      <div className="flex flex-col justify-center items-center rounded-2xl bg-gray-800/60 border-2 border-dashed border-gray-600 text-gray-300 w-48 min-h-[12rem] flex-shrink-0 p-4">
        {children}
      </div>
    </div>
  );
}
