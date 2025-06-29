import { AutoCompleteResult } from "../page";

type Props = {
  data: AutoCompleteResult[];
  handleSelectResult: (
    e: React.MouseEvent<HTMLElement>,
    id: number,
    name: string,
    image: string
  ) => void;
};

const SearchResults = ({ data, handleSelectResult }: Props) =>
  data.length > 0 && (
    <div className="pointer-events-auto rounded-lg bg-white text-[0.8125rem]/5 text-slate-700 ring-1 shadow-xl shadow-black/5 ring-slate-700/10 max-w-2xl mx-auto">
      <div className="px-3.5 py-3">
        {data.map((result: AutoCompleteResult) => (
          <div
            key={result.id}
            onClick={(e) =>
              handleSelectResult(e, result.id, result.name, result.image_url)
            }
            className="flex items-center rounded-md p-1.5 hover:bg-indigo-600 hover:text-white cursor-pointer"
          >
            <img
              src={result.image_url}
              alt={result.name}
              loading="lazy"
              className="w-10 h-10 rounded object-contain mr-5 bg-gray-200"
            />
            {result.name}
          </div>
        ))}
      </div>
    </div>
  );

export default SearchResults;
