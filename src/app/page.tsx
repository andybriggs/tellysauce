"use client";

import { useState, useMemo } from "react";
import SearchResults from "./components/SearchResults";
import ResultsTable from "./components/ResultsTable";
import debounce from "lodash/debounce";

const API_KEY = process.env.NEXT_PUBLIC_WATCHMODE_API_KEY;
const AUTO_COMPLETE_API = `https://api.watchmode.com/v1/autocomplete-search/?apiKey=${API_KEY}&search_field=name&search_value=`;
const STREAM_SOURCE_API = (showId: number) =>
  `https://api.watchmode.com/v1/title/${showId}/sources/?apiKey=${API_KEY}`;

export type AutoCompleteResult = {
  id: number;
  name: string;
  image_url: string;
};

export type StreamingSource = {
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
  const showClearResults = searchQuery !== "";

  const filteredStreamingSources = isGBOnly
    ? showStreamingSources.filter(
        (source: StreamingSource) => source.region === "GB"
      )
    : showStreamingSources;

  console.log(filteredStreamingSources);

  const fetchAutoCompleteResults = async (query: string) => {
    if (query) {
      const response = await fetch(AUTO_COMPLETE_API + query);
      const data = await response.json();
      setAutoCompleteResults(data.results);
    } else {
      setAutoCompleteResults([]);
    }
  };

  const fetchSourcesResults = async (id: number) => {
    const api = STREAM_SOURCE_API(id);
    const response = await fetch(api);
    const data = await response.json();
    setShowStreamingSources(data);
  };

  const handleSubmit = (query: string) => {
    fetchAutoCompleteResults(query);
    setShowStreamingSources([]);
    setShowTitle("");
  };

  const debouncedSubmit = useMemo(
    () => debounce((query: string) => handleSubmit(query), 1000),
    []
  );

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    debouncedSubmit(e.target.value);
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
  };

  return (
    <>
      <section className="w-full bg-linear-to-r from-cyan-700 via-blue-500 to-indigo-600">
        <div className="relative px-6 py-20 overflow-hidden text-center isolate sm:px-16 sm:shadow-sm dark:bg-transparent">
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
              onClick={
                showClearResults
                  ? handleClearSearch
                  : () => handleSubmit(searchQuery)
              }
              className="relative w-full px-6 py-3 overflow-hidden text-white transition-all duration-100 bg-black border border-black md:w-auto fill-white active:scale-95 will-change-transform rounded-xl"
            >
              <span className="flex items-center transition-all opacity-1">
                <span className="mx-auto text-sm font-semibold truncate whitespace-nowrap">
                  {showClearResults ? "Clear" : "Search"}
                </span>
              </span>
            </button>
          </div>
          <SearchResults
            data={autoCompleteResults}
            handleSelectResult={handleSelectResult}
          />
        </div>
      </section>
      <section>
        <div className="p-4">
          <h2 className="text-2xl text-center font-semibold text-gray-800 dark:text-gray-200 pt-4 pb-8">
            {showTitle}
          </h2>
          <ResultsTable data={filteredStreamingSources} />
          {hasNoShows && (
            <p className="text-center text-gray-500 ">No results</p>
          )}
        </div>
      </section>
    </>
  );
}
