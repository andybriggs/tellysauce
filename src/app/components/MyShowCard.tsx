import Image from "next/image";
import { Show } from "../types";
import StarRating from "./StarRating";
import Link from "next/link";

const MyShowCard = ({
  show,
  rateShow,
}: {
  show: Show;
  rateShow: (id: number, rating: number) => void;
}) => {
  const { image, name, id } = show;

  return (
    <Link href={`/title/${id}`}>
      <div className="bg-white h-full w-full flex flex-col rounded-xl shadow-md py-8 px-4">
        <div className="px-6 flex flex-col h-full">
          {image && (
            <div className="flex flex-wrap justify-center">
              <div className="w-full flex justify-center">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg -mt-12">
                  <Image
                    src={image}
                    alt={name}
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="text-center m-2 p-2 border-b border-slate-200">
            <h3 className=" text-slate-700 font-bold leading-normal mb-1 whitespace-nowrap">
              {name}
            </h3>
          </div>
          <StarRating showId={id} rating={show.rating} rateShow={rateShow} />
        </div>
      </div>
    </Link>
  );
};

export default MyShowCard;
