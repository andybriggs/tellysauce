// app/components/MyShowCard.tsx
import Image from "next/image";
import { Show } from "../types";
import StarRating from "./StarRating";
import Link from "next/link";

type Props = {
  show: Show;
  rateShow?: (id: number, rating: number) => void; // ⬅️ optional
};

const MyShowCard = ({ show, rateShow }: Props) => {
  const { image, name, id } = show;
  const showStars = typeof rateShow === "function";

  return (
    <Link href={`/title/${id}`} className="block flex-none">
      <div className="relative w-48 h-64 flex-none rounded-xl shadow-md overflow-hidden snap-start select-none">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 will-change-transform hover:scale-105"
            sizes="256px"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-800" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

        <div className="absolute top-0 left-0 right-0 flex justify-center p-3">
          <span
            className="bg-black/50 px-3 py-1 rounded-md text-white text-lg font-bold truncate max-w-[90%]"
            title={name}
          >
            {name}
          </span>
        </div>

        {/* Rating only when rateShow is provided */}
        {showStars && (
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <StarRating showId={id} rating={show.rating} rateShow={rateShow!} />
          </div>
        )}
      </div>
    </Link>
  );
};

export default MyShowCard;
