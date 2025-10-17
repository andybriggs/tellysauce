// app/components/StarRating.tsx
import { StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import clsx from "clsx";

const StarRating = ({
  rating,
  titleId,
  titleType,
  rateTitle,
}: {
  rating: number;
  titleId: number;
  titleType: "tv" | "movie";
  rateTitle: (id: number, mediaType: "tv" | "movie", rating: number) => void;
}) => {
  const getStarIcon = (index: number) =>
    index < rating ? (
      <StarIcon className="w-8 h-8" />
    ) : (
      <StarIconOutline
        className={clsx("w-8 h-8", !Boolean(rating) ? "animate-pulse" : "")}
      />
    );

  return (
    <div className="text-center mt-3 flex items-center">
      <ul className="flex text-yellow-500 pt-2">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                rateTitle(titleId, titleType, index + 1);
              }}
              aria-label={`Rate ${index + 1} star${index === 0 ? "" : "s"}`}
            >
              {getStarIcon(index)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StarRating;
