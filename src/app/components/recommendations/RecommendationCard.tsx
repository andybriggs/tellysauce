"use client";

import { Recommendation } from "@/app/types";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { memo } from "react";

type Props = {
  rec: Recommendation;
  onOpen: () => void;
};

function Card({ rec, onOpen }: Props) {
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left relative overflow-hidden rounded-3xl p-6 md:p-8 cursor-pointer bg-white/10 backdrop-blur-md ring-1 ring-white/15 shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:bg-white/[.12] hover:ring-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        aria-label={`Open ${rec.title}`}
      >
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15 whitespace-nowrap">
          <SparklesIcon className="h-4 w-4" />
          AI pick
        </span>

        <h3 className="pr-24 text-white text-2xl md:text-[28px] font-semibold tracking-tight leading-tight">
          {rec.title}
        </h3>

        {rec.tags?.length ? (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {rec.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-black/25 px-4 py-2 text-[14px] text-white/80 ring-1 ring-white/10"
              >
                {t}
              </span>
            ))}
          </p>
        ) : null}

        {rec.description && (
          <p className="mt-4 text-white/85 text-base md:text-lg leading-relaxed line-clamp-3">
            {rec.description}
          </p>
        )}

        {rec.reason && (
          <div className="mt-5">
            <div className="flex items-center gap-3">
              <span className="h-px w-6 bg-white/15" />
              <h4 className="text-[11px] font-medium tracking-wider text-white/65">
                Why we think you’ll like it
              </h4>
            </div>
            <p className="mt-2 text-white/75 text-sm md:text-base leading-relaxed line-clamp-3">
              {rec.reason}
            </p>
          </div>
        )}
      </button>
    </li>
  );
}

export default memo(Card);
