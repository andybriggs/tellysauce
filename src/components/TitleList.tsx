"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

import { Title } from "@/types";
import TitleCard from "./TitleCard";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

export type Layout = "carousel" | "grid";

export interface TitleListProps {
  items: Title[];
  layout?: Layout;
  renderItem?: (title: Title) => ReactNode;
}

const TitleList = ({
  items,
  layout = "carousel",
  renderItem,
}: TitleListProps) => {
  const isGrid = layout === "grid";

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: false,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    updateButtons();
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);

    return () => {
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi, updateButtons]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (isGrid) {
    return (
      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 py-4">
        {items.map((item) => (
          <li key={item.id} className="h-auto">
            {renderItem ? renderItem(item) : <TitleCard title={item} />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="py-4">
      <div ref={emblaRef} className="overflow-hidden">
        <ul className="flex items-stretch gap-4">
          {items.map((item) => (
            <li key={item.id} className="flex-[0_0_auto] mb-6">
              {renderItem ? renderItem(item) : <TitleCard title={item} />}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          aria-label="Scroll left"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          className="
            group inline-flex items-center justify-center
            h-9 w-9 rounded-full
            border border-gray-200
            bg-white
            shadow-sm
            transition
            hover:bg-gray-100
            disabled:opacity-30
            disabled:cursor-not-allowed
          "
        >
          <ChevronLeftIcon className="h-5 w-5 text-gray-700 transition group-hover:text-gray-900" />
        </button>

        <button
          type="button"
          aria-label="Scroll right"
          onClick={scrollNext}
          disabled={!canScrollNext}
          className="
            group inline-flex items-center justify-center
            h-9 w-9 rounded-full
            border border-gray-200
            bg-white
            shadow-sm
            transition
            hover:bg-gray-100
            disabled:opacity-30
            disabled:cursor-not-allowed
          "
        >
          <ChevronRightIcon className="h-5 w-5 text-gray-700 transition group-hover:text-gray-900" />
        </button>
      </div>
    </div>
  );
};

export default TitleList;
