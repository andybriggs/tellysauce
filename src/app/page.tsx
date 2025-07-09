"use client";

import { useState, useMemo } from "react";
import SearchResults from "./components/SearchResults";
import ResultsTable from "./components/ResultsTable";
import debounce from "lodash/debounce";
import Hero from "./components/Hero";
import Search from "./components/Search";

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

  const [showTitle, setShowTitle] = useState("");
  const [showStreamingSources, setShowStreamingSources] = useState([]);

  const [isInternational, setIsInternational] = useState(false);
  const [background, setBackground] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const showClearResults = searchQuery !== "";

  const filteredStreamingSources = !isInternational
    ? showStreamingSources.filter(
        (source: StreamingSource) => source.region === "GB"
      )
    : showStreamingSources;

  const fetchAutoCompleteResults = async (query: string) => {
    setIsLoading(true);
    if (query) {
      const response = await fetch(AUTO_COMPLETE_API + query);
      const data = await response.json();
      setIsLoading(false);
      setAutoCompleteResults(data.results);
    } else {
      setAutoCompleteResults([]);
      setIsLoading(false);
    }
  };

  const fetchSourcesResults = async (id: number) => {
    const api = STREAM_SOURCE_API(id);
    const response = await fetch(api);
    const data = await response.json();
    if (data.length > 0) setShowStreamingSources(data);
  };

  const handleSubmit = (query: string) => {
    fetchAutoCompleteResults(query);
    setBackground(undefined);
    setShowStreamingSources([]);
    setShowTitle("");
  };

  const debouncedSubmit = useMemo(
    () => debounce((query: string) => handleSubmit(query), 500),
    []
  );

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    debouncedSubmit(e.target.value);
  };

  const handleSelectResult = (
    e: React.MouseEvent<HTMLElement>,
    showId: number,
    showTitle: string,
    showImage: string
  ) => {
    e.preventDefault();
    setAutoCompleteResults([]);
    setSearchQuery(showTitle);
    setShowTitle(showTitle);
    fetchSourcesResults(showId);
    setBackground(showImage);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setAutoCompleteResults([]);
    setShowStreamingSources([]);
    setBackground(undefined);
    setShowTitle("");
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsInternational(e.target.checked);
  };

  console.log(isLoading);

  return (
    <>
      <section className="w-full bg-amber-50">
        <div className="relative px-6 py-20 overflow-hidden text-center isolate sm:px-16 sm:shadow-sm dark:bg-transparent">
          <Hero />
          <Search
            handleSearchInputChange={handleSearchInputChange}
            searchQuery={searchQuery}
            isLoading={isLoading}
            showClearResults={showClearResults}
            handleSubmit={handleSubmit}
            handleClearSearch={handleClearSearch}
          />
          {Boolean(searchQuery) &&
            !isLoading &&
            autoCompleteResults.length > 0 && (
              <SearchResults
                data={autoCompleteResults}
                handleSelectResult={handleSelectResult}
              />
            )}
        </div>
      </section>
      {showTitle && (
        <section
          className="relative bg-no-repeat bg-cover pixelate"
          style={{ backgroundImage: `url(${background})`, zIndex: 1 }}
        >
          <div className="relative p-4">
            <h2 className="text-2xl text-center font-semibold text-white pt-4">
              <span className="bg-black/70 px-4 py-2 rounded inline-block">
                {showTitle}
              </span>
            </h2>
            <div className="flex items-center mt-4 w-full justify-center text-gray-600 mb-8">
              <span className="bg-black/40 px-4 py-2 rounded inline-block">
                <input
                  id="default-checkbox"
                  type="checkbox"
                  value=""
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  onChange={handleCheckboxChange}
                />
                <label
                  htmlFor="default-checkbox"
                  className="ms-2 text-sm font-medium text-white dark:text-gray-300"
                >
                  Show International
                </label>
              </span>
            </div>
            <ResultsTable data={filteredStreamingSources} />
          </div>
        </section>
      )}
    </>
  );
}
