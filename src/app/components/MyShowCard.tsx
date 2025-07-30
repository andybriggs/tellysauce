import Image from "next/image";
import { SHOW_TYPES } from "../contants";
import { Show } from "../types";
import { TrashIcon } from "@heroicons/react/24/outline";

const MyShowCard = ({
  show,
  removeShow,
}: {
  show: Show;
  removeShow: (id: number) => void;
}) => {
  const { image, name, type, id } = show;

  return (
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
          <h3 className="text-2xl text-slate-700 font-bold leading-normal mb-1">
            {name}
          </h3>
          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset">
            {SHOW_TYPES[type as keyof typeof SHOW_TYPES] || type}
          </span>
        </div>

        {/* Spacer to push the button to the bottom */}
        <div className="flex-grow" />

        <div className="flex justify-center">
          <div className="w-full px-4">
            <button
              className="bg-red-500 text-white text-small py-2 px-4 rounded-md flex gap-2 items-center"
              onClick={() => removeShow(id)}
            >
              <TrashIcon className="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyShowCard;
