import { Show } from "../types";

const MyShowCard = ({ show }: { show: Show }) => {
  const { image, name } = show;

  return (
    <div className="relative">
      <div className="h-56 w-72 absolute flex justify-center items-center">
        <img
          className="object-cover h-20 w-20 rounded-full"
          src={image}
          alt=""
        />
      </div>

      <div
        className="
            h-56
            mx-4
            w-5/6
            bg-blue-400
            rounded-3xl
            shadow-md
            sm:w-80 sm:mx-0
          "
      >
        <div
          className="
              bg-white
              h-1/2
              w-full
              rounded-3xl
              flex flex-col
              justify-around
              items-center
            "
        >
          <div className="">
            <span className="text-gray-700 font-bold">{name}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyShowCard;
