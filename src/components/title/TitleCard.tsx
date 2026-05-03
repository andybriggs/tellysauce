"use client";

import Image from "next/image";
import { Title } from "@/types/";
import StarRating from "@/components/watchlist/StarRating";
import TitleStatusBadge from "./TitleStatusBadge";
import Link from "next/link";

const POSTER_BLUR_PLACEHOLDER =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#1e293b"/></svg>'
  );

type Props = {
  title: Title;
  rateTitle?: (
    id: number,
    mediaType: "tv" | "movie",
    rating: number
  ) => Promise<void>;
  showStatusOverlay?: boolean;
  fill?: boolean;
};

const TitleCard = ({ title, rateTitle, showStatusOverlay, fill }: Props) => {
  const { poster, name, id, type } = title;
  const titleStars = typeof rateTitle === "function";

  return (
    <Link href={`/title/${type}/${id}`} className={fill ? "block w-full h-full" : "block flex-none"}>
      <div className={`relative ${fill ? "w-full h-full" : "w-48 h-64 flex-none"} rounded-xl shadow-md overflow-hidden snap-start select-none`}>
        {poster ? (
          <Image
            src={poster}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 will-change-transform hover:scale-105"
            sizes="256px"
            placeholder="blur"
            blurDataURL={POSTER_BLUR_PLACEHOLDER}
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

        {titleStars && (
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <StarRating
              titleId={id}
              titleType={type as "tv" | "movie"}
              rating={title.rating}
            />
          </div>
        )}

        {showStatusOverlay && (
          <TitleStatusBadge id={id} type={type as "tv" | "movie"} />
        )}
      </div>
    </Link>
  );
};

export default TitleCard;
