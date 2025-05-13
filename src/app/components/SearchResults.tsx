import { AutoCompleteResult } from "../page";

type Props =  {
  data: AutoCompleteResult[];
  handleSelectResult: (e: React.MouseEvent<HTMLElement>, id: number, name: string) => void;
}

const SearchResults = ({ data, handleSelectResult }: Props) => (data.length > 0 && (
  <div className="pointer-events-auto rounded-lg bg-white text-[0.8125rem]/5 text-slate-700 ring-1 shadow-xl shadow-black/5 ring-slate-700/10">
    <div className="px-3.5 py-3">
      {data.map((result: AutoCompleteResult) => (
        <div
          key={result.id}
          onClick={(e) =>
            handleSelectResult(e, result.id, result.name)
          }
          className="flex items-center rounded-md p-1.5 hover:bg-indigo-600 hover:text-white"
        >
          {result.name}
        </div>
      ))}
    </div>
  </div>
));

export default SearchResults;