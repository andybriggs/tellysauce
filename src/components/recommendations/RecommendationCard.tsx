"use client";

import { Recommendation } from "@/types";
import { SparklesIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { memo, useMemo } from "react";

type Props = {
  rec: Recommendation & { year?: number | null };
};

function Card({ rec }: Props) {
  const href = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("q", rec.title);
    if (typeof rec.year === "number" && Number.isFinite(rec.year))
      qs.set("year", String(rec.year));
    if (rec.description) qs.set("desc", rec.description.slice(0, 160));
    if (rec.tags?.length) {
      const tags = Array.from(new Set(rec.tags)).slice(0, 8).join(",");
      if (tags) qs.set("tags", tags);
    }
    return `/open/title?${qs.toString()}`;
  }, [rec.title, rec.year, rec.description, rec.tags]);

  const year =
    typeof rec.year === "number" && Number.isFinite(rec.year) ? rec.year : null;
  const tags = Array.from(new Set(rec.tags ?? [])).slice(0, 4);

  return (
    <li className="group relative w-full text-left">
      <Link
        href={href}
        prefetch={false}
        aria-label={`Open ${rec.title}${year ? ` (${year})` : ""}`}
        className="block overflow-hidden rounded-3xl ring-1 ring-white/10 bg-white/5 backdrop-blur-md
                   transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 hover:ring-white/20
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
      >
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/20 blur-2xl" />
        </div>

        {/* Corner badge */}
        <span className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15">
          <SparklesIcon className="h-4 w-4" />
          AI pick
        </span>

        <div className="p-6 md:p-8">
          {/* Title row */}
          <div
            className="
              flex flex-wrap items-start gap-2 md:gap-3
              pr-24 md:pr-32       /* real gutter so we never sit under the badge */
              min-w-0              /* allow text to wrap instead of overflow */
            "
          >
            <h3
              className="
                text-white text-2xl md:text-[28px] font-semibold tracking-tight leading-snug
                break-words hyphens-auto
                /* no line-clamp -> no truncation */
              "
            >
              {rec.title}
            </h3>

            {year && (
              <span
                className="
                  shrink-0 rounded-md border border-white/15 bg-black/40 px-2 py-0.5
                  text-[11px] text-white/85
                  md:self-center
                "
                aria-label={`Year ${year}`}
              >
                {year}
              </span>
            )}
          </div>

          {/* Tags: higher contrast, subtle ring + inner highlight */}
          {tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full bg-white/18 text-white/95 text-[12px] font-medium
                             px-3 py-1 ring-1 ring-white/25 shadow-inner shadow-white/10
                             transition-colors hover:bg-white/24"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}

          {rec.description && (
            <p className="mt-4 text-white/90 text-[15px] md:text-[16px] leading-relaxed">
              {rec.description}
            </p>
          )}

          {rec.reason && (
            <div className="mt-5 rounded-2xl border border-white/12 bg-white/[0.045] p-4">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/65">
                <span className="inline-block h-[1px] w-5 bg-white/25" />
                Why you’ll like it
              </div>
              <p className="text-white/80 text-[14px] md:text-[15px] leading-relaxed">
                {rec.reason}
              </p>
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

export default memo(Card);
