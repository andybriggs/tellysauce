"use client";

import { useState, useMemo } from "react";
import SearchResults from "./components/SearchResults";
import ResultsTable from "./components/ResultsTable";
import debounce from "lodash/debounce";
import Hero from "./components/Hero";
import Search from "./components/Search";
import Image from "next/image";
import { SHOW_TYPES } from "./contants";

const API_KEY = process.env.NEXT_PUBLIC_WATCHMODE_API_KEY;
const AUTO_COMPLETE_API = `https://api.watchmode.com/v1/autocomplete-search/?apiKey=${API_KEY}&search_field=name&search_value=`;
const STREAM_SOURCE_API = (showId: number) =>
  `https://api.watchmode.com/v1/title/${showId}/sources/?apiKey=${API_KEY}`;

export type AutoCompleteResult = {
  id: number;
  name: string;
  image_url: string;
  type: string;
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
  const [showImage, setShowImage] = useState<string | undefined>(undefined);
  const [showType, setShowType] = useState<string | undefined>(undefined);

  const [showStreamingSources, setShowStreamingSources] = useState([]);
  const [isInternational, setIsInternational] = useState(false);
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
    setShowImage(undefined);
    setShowStreamingSources([]);
    setShowTitle("");
    setShowType(undefined);
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
    showImage: string,
    showType: string
  ) => {
    e.preventDefault();
    setAutoCompleteResults([]);
    setSearchQuery(showTitle);
    setShowTitle(showTitle);
    fetchSourcesResults(showId);
    setShowImage(showImage);
    setShowType(showType);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setAutoCompleteResults([]);
    setShowStreamingSources([]);
    setShowImage(undefined);
    setShowTitle("");
    setShowType(undefined);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsInternational(e.target.checked);
  };

  console.log(showType);

  return (
    <>
      <section className="w-full bg-amber-50">
        <div className="relative px-6 py-20 text-center isolate sm:px-16 sm:shadow-sm dark:bg-transparent">
          <Hero />
          <div className="max-w-2xl mx-auto relative overflow-visible">
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
        </div>
      </section>
      {showTitle && (
        <section className="relative bg-black h-screen">
          <div className="relative p-4">
            <div className="flex items-center justify-center">
              {showImage && (
                <Image
                  src={showImage}
                  alt={showTitle}
                  width={48}
                  height={48}
                  className="inline-block align-middle rounded shadow bg-white mr-4"
                />
              )}
              <div>
                <h2 className="text-2xl text-center font-semibold text-white self-start">
                  {showTitle}
                </h2>
                <p className="mt-1 text-left">
                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset">
                    {SHOW_TYPES[showType as keyof typeof SHOW_TYPES] ||
                      showType}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col mt-8 max-w-3xl mx-auto">
              <label
                htmlFor="default-checkbox"
                className="ms-2 text-sm font-medium text-white dark:text-gray-300 flex gap-2 items-center mb-2"
              >
                <input
                  id="default-checkbox"
                  type="checkbox"
                  value=""
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  onChange={handleCheckboxChange}
                />
                Show International
              </label>
              <ResultsTable data={filteredStreamingSources} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
