"use client";

import { StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRatedTitles } from "@/hooks/useRatedTitles";

const StarRating = ({
  rating,
  titleId,
  titleType,
}: {
  rating: number;
  titleId: number;
  titleType: "tv" | "movie";
}) => {
  const { isLoading, rateTitle } = useRatedTitles();

  const getStarIcon = (index: number) =>
    index < rating ? (
      <StarIcon
        className={clsx(
          "w-8 h-8 transition-all duration-150",
          isLoading && "opacity-50 animate-pulse"
        )}
      />
    ) : (
      <StarIconOutline
        className={clsx(
          "w-8 h-8 transition-all duration-150",
          isLoading
            ? "opacity-50 animate-pulse"
            : !Boolean(rating)
            ? "animate-pulse"
            : ""
        )}
      />
    );

  return (
    <div className="text-center mt-3 flex items-center justify-center">
      <div className="relative inline-block">
        <ul
          className={clsx(
            "flex text-yellow-500 pt-2 gap-1",
            isLoading && "opacity-80"
          )}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index}>
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  rateTitle(titleId, titleType, index + 1);
                }}
                aria-label={`Rate ${index + 1} star${index === 0 ? "" : "s"}`}
                disabled={isLoading}
                className={clsx(
                  "transition-transform",
                  isLoading
                    ? "pointer-events-none"
                    : "hover:scale-110 active:scale-95"
                )}
              >
                {getStarIcon(index)}
              </button>
            </li>
          ))}
        </ul>

        {/* Loading overlay spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-5 h-5 border-2 border-white-400 border-t-transparent rounded-full animate-spin drop-shadow-md"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StarRating;
