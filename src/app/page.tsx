"use client";

import { useState } from "react";

const API_KEY = process.env.NEXT_PUBLIC_WATCHMODE_API_KEY;
const AUTO_COMPLETE_API = `https://api.watchmode.com/v1/autocomplete-search/?apiKey=${API_KEY}&search_field=name&search_value=`;
const STREAM_SOURCE_API = (showId: number) =>
  `https://api.watchmode.com/v1/title/${showId}/sources/?apiKey=${API_KEY}`;

type AutoCompleteResult = {
  id: number;
  name: string;
};

type StreamingSource = {
  name: string;
  region: string;
  type: string;
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [autoCompleteResults, setAutoCompleteResults] = useState([]);
  const [showStreamingSources, setShowStreamingSources] = useState([]);
  const [showTitle, setShowTitle] = useState("");
  const [isGBOnly, setIsGBOnly] = useState(false);

  const hasNoShows = showTitle && showStreamingSources.length === 0;
  const showClearResults = searchQuery === showTitle && searchQuery !== "";

  const filteredStreamingSources = isGBOnly ? showStreamingSources.filter((source: StreamingSource) => source.region === "GB") : showStreamingSources;

  const fetchAutoCompleteResults = async (query: string) => {
    const response = await fetch(AUTO_COMPLETE_API + query);
    const data = await response.json();
    setAutoCompleteResults(data.results);
  };

  const fetchSourcesResults = async (id: number) => {
    const api = STREAM_SOURCE_API(id);
    const response = await fetch(api);
    const data = await response.json();
    setShowStreamingSources(data);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSubmit = () => {
    fetchAutoCompleteResults(searchQuery);
    setShowStreamingSources([]);
    setShowTitle("");
  };

  const handleSelectResult = (
    e: React.MouseEvent<HTMLElement>,
    showId: number,
    showTitle: string
  ) => {
    e.preventDefault();
    setAutoCompleteResults([]);
    setSearchQuery(showTitle);
    setShowTitle(showTitle);
    fetchSourcesResults(showId);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setAutoCompleteResults([]);
    setShowStreamingSources([]);
    setShowTitle("");
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsGBOnly(e.target.checked);
  }

  return (
    <>
      <section className="w-full">
        <div className="relative px-6 py-20 overflow-hidden text-center bg-white isolate sm:px-16 sm:shadow-sm dark:bg-transparent">
          <p className="max-w-2xl mx-auto text-3xl font-bold text-gray-900 dark:text-gray-200 sm:text-4xl">
            Telly Sauce!
          </p>
          <p className="max-w-xl mx-auto mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Find out where you can stream your favourtie TV shows.
          </p>
          <div className="flex items-center mt-4 w-full justify-center text-gray-600">
            <input
              id="default-checkbox"
              type="checkbox"
              value=""
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              onChange={handleCheckboxChange}
            />
            <label
              htmlFor="default-checkbox"
              className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
            >
              Show GB only
            </label>
          </div>
          <div className="relative flex flex-col items-center justify-center max-w-2xl gap-2 px-2 py-2 mx-auto mt-8 bg-white border shadow-2xl dark:bg-gray-50 min-w-sm md:flex-row rounded-2xl focus-within:border-gray-300">
            <input
              id="search-bar"
              placeholder="Twin Peaks"
              onChange={handleSearchInputChange}
              value={searchQuery}
              className="flex-1 w-full px-6 py-2 bg-white rounded-md outline-none dark:bg-gray-50"
              type="text"
            />
            <button
              type="submit"
              onClick={showClearResults ? handleClearSearch : handleSubmit}
              className="relative w-full px-6 py-3 overflow-hidden text-white transition-all duration-100 bg-black border border-black md:w-auto fill-white active:scale-95 will-change-transform rounded-xl"
            >
              <span className="flex items-center transition-all opacity-1">
                <span className="mx-auto text-sm font-semibold truncate whitespace-nowrap">
                  {showClearResults ? "Clear" : "Search"}
                </span>
              </span>
            </button>
          </div>
          {autoCompleteResults.length > 0 && (
            <div className="pointer-events-auto rounded-lg bg-white text-[0.8125rem]/5 text-slate-700 ring-1 shadow-xl shadow-black/5 ring-slate-700/10">
              <div className="px-3.5 py-3">
                {autoCompleteResults.map((result: AutoCompleteResult) => (
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
          )}
          <svg
            viewBox="0 0 1024 1024"
            className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-x-1/2 [mask-image:radial-gradient(closest-side,white,transparent)]"
            aria-hidden="true"
          >
            <circle
              cx="512"
              cy="512"
              r="512"
              fill="url(#827591b1-ce8c-4110-b064-7cb85a0b1217)"
              fillOpacity="0.7"
            ></circle>
            <defs>
              <radialGradient id="827591b1-ce8c-4110-b064-7cb85a0b1217">
                <stop stopColor="#3b82f6"></stop>
                <stop offset="1" stopColor="#1d4ed8"></stop>
              </radialGradient>
            </defs>
          </svg>
        </div>
      </section>
      <section>
        <div className="p-4">
          <h2 className="text-2xl text-center font-semibold text-gray-800 dark:text-gray-200 pt-4 pb-8">
            {showTitle}
          </h2>
          {filteredStreamingSources.length > 0 && (
            <table className="w-full table-auto border-collapse text-sm w-full max-w-3xl mx-auto">
              <thead>
                <tr>
                  <th className="border-b border-gray-200 p-4 pt-0 pb-3 pl-8 text-left font-medium text-gray-400 dark:border-gray-600 dark:text-gray-200">
                    Service
                  </th>
                  <th className="border-b border-gray-200 p-4 pt-0 pb-3 text-left font-medium text-gray-400 dark:border-gray-600 dark:text-gray-200">
                    Region
                  </th>
                  <th className="border-b border-gray-200 p-4 pt-0 pr-8 pb-3 text-left font-medium text-gray-400 dark:border-gray-600 dark:text-gray-200">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800">
                {filteredStreamingSources.map((source: StreamingSource, i) => (
                  <tr key={i}>
                    <td className="border-b border-gray-100 p-4 pl-8 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      {source.name}
                    </td>
                    <td className="border-b border-gray-100 p-4 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      {source.region}
                    </td>
                    <td className="border-b border-gray-100 p-4 pr-8 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      {source.type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {hasNoShows && (
            <p className="text-center text-gray-500 ">No results</p>
          )}
        </div>
      </section>
    </>
  );
}
