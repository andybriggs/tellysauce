"use client";

import Image from "next/image";
import { useMyShows } from "../hooks/useMyShows";
import { useGeminiRecommendations } from "../hooks/useRecommendations";
import { useStreamingSearch } from "../hooks/useStreamingSearch";

export default function RecommendShows() {
  const { myShows } = useMyShows();
  const { recommendations, isLoading, getRecommendations } =
    useGeminiRecommendations();
  const { dispatch, fetchAutoCompleteResults } = useStreamingSearch();

  const handleClick = () => {
    const showNames = myShows.map((show) => show.name);
    getRecommendations(showNames);
  };

  const handleStreamingSearch = async (title: string) => {
    dispatch({ type: "SET_QUERY", payload: title });
    fetchAutoCompleteResults(title);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="bg-green-500 text-white text-sm py-2 px-4 rounded-md flex gap-2 items-center hover:bg-green-600 disabled:opacity-50"
      >
        {isLoading ? "Thinking..." : "Get Recommendations"}
      </button>

      <ul className="mt-6 space-y-4">
        {recommendations.map((rec, idx) => (
          <li
            key={idx}
            className="bg-white rounded-xl p-4 shadow-md flex flex-col sm:flex-row sm:justify-between sm:items-center"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {rec.title}
              </h3>
              <p>
                {rec.tags?.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset mr-1"
                  >
                    {tag}
                  </span>
                ))}
              </p>
              <p className="text-gray-700 text-sm mt-1">{rec.description}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <a
                href={`https://www.google.com/search?q=site:imdb.com+${encodeURIComponent(
                  rec.title
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 text-white text-sm py-2 px-4 rounded-md flex gap-2 items-center hover:bg-blue-600 disabled:opacity-50"
              >
                <Image
                  src="/imdb.png"
                  alt="IMDb"
                  width={20}
                  height={20}
                  className="rounded-md border border-black self-left"
                />
                IMDb
              </a>
              <button
                disabled
                onClick={() => handleStreamingSearch(rec.title)}
                className="bg-blue-500 text-white text-sm py-2 px-4 rounded-md flex gap-2 items-center disabled:opacity-50"
              >
                <Image
                  src="/logo.png"
                  alt="Streaming"
                  width={10}
                  height={10}
                  className="rounded-md border border-black self-left"
                />
                Sauce?
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
