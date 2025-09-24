import { useState } from "react";
import { AutoCompleteResult } from "@/app/types";
import Image from "next/image";
import clsx from "clsx";
import Link from "next/link";

type Props = {
  data: AutoCompleteResult[];
};

const Shimmer = () => (
  <div className="relative w-12 h-20 mr-4">
    <div
      className="
        absolute inset-0 rounded shadow
        bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200
        [background-size:200%_100%]
        animate-[shimmer_1.2s_linear_infinite]
        motion-reduce:animate-none
      "
    />
  </div>
);

const SearchResults = ({ data }: Props) => {
  return (
    <div className="absolute w-full pointer-events-auto rounded-lg bg-white text-[0.8125rem]/5 text-slate-700 ring-1 shadow-xl shadow-black/5 ring-slate-700/10 mx-auto">
      <div className="px-3.5 py-3">
        {data.length > 0 ? (
          data.map((result) => <ResultItem key={result.id} result={result} />)
        ) : (
          <p>No results</p>
        )}
      </div>
    </div>
  );
};

const ResultItem = ({ result }: { result: AutoCompleteResult }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <Link
      href={`/title/${result.type}/${result.id}`}
      className="flex items-center rounded-md p-1.5 hover:bg-indigo-600 hover:text-white cursor-pointer"
    >
      {!loaded && <Shimmer />}
      {result.poster && (
        <Image
          src={result.poster}
          alt={result.name}
          width={48}
          height={48}
          className={clsx(
            "inline-block align-middle rounded shadow mr-4 transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0 absolute"
          )}
          onLoadingComplete={() => setLoaded(true)}
        />
      )}
      {result.name}
    </Link>
  );
};

export default SearchResults;
