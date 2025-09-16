import { StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";

const StarRating = ({
  rating,
  showId,
  rateShow,
}: {
  rating: number;
  showId: number;
  rateShow: (id: number, rating: number) => void;
}) => {
  const getStarIcon = (index: number) =>
    index < rating ? (
      <StarIcon className="w-8 h-8" />
    ) : (
      <StarIconOutline className="w-8 h-8" />
    );

  return (
    <div>
      <p className="text-gray-600 text-sm text-center">
        {rating ? "Your rating" : "Rate this title"}
      </p>
      <ul className="flex text-yellow-500 pt-2 pb-4 justify-center">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                rateShow(showId, index + 1);
              }}
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
