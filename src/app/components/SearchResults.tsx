import { AutoCompleteResult } from "@/app/types";
import Image from "next/image";

type Props = {
  data: AutoCompleteResult[];
  handleSelectResult: (
    e: React.MouseEvent<HTMLElement>,
    id: number,
    name: string,
    image: string,
    type: string
  ) => void;
};

const SearchResults = ({ data, handleSelectResult }: Props) => (
  <div className="absolute w-full pointer-events-auto rounded-lg bg-white text-[0.8125rem]/5 text-slate-700 ring-1 shadow-xl shadow-black/5 ring-slate-700/10 mx-auto">
    <div className="px-3.5 py-3">
      {data.length > 0 ? (
        data.map((result: AutoCompleteResult) => (
          <div
            key={result.id}
            onClick={(e) =>
              handleSelectResult(
                e,
                result.id,
                result.name,
                result.image_url,
                result.type
              )
            }
            className="flex items-center rounded-md p-1.5 hover:bg-indigo-600 hover:text-white cursor-pointer"
          >
            <Image
              src={result.image_url}
              alt={result.name}
              width={48}
              height={48}
              className="inline-block align-middle rounded shadow bg-white mr-4"
            />
            {result.name}
          </div>
        ))
      ) : (
        <p>No results</p>
      )}
    </div>
  </div>
);

export default SearchResults;
