"use client";

import { useMemo, useEffect } from "react";
import { debounce } from "lodash";
import { useStreamingSearch } from "./hooks/useStreamingSearch";
import { useMyShows } from "./hooks/useMyShows";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import Hero from "./components/Hero";
import Search from "./components/Search";
import SearchResults from "./components/SearchResults";
import ResultsTable from "./components/ResultsTable";
import Image from "next/image";
import { SHOW_TYPES } from "./contants";
import MyShows from "./components/MyShows";
import { Show } from "./types";
import RecommendShows from "./components/RecommendShows";

export default function Home() {
  const { state, dispatch, fetchAutoCompleteResults, fetchSourcesResults } =
    useStreamingSearch();

  const { addShow, removeShow, isSaved } = useMyShows();

  const {
    searchQuery,
    autoCompleteResults,
    showName,
    showId,
    showImage,
    showType,
    showStreamingSources,
    isInternational,
    isLoading,
    isShowAdded,
  } = state;

  const debouncedSubmit = useMemo(() => {
    return debounce((query: string) => {
      fetchAutoCompleteResults(query);
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      debouncedSubmit.cancel();
    };
  }, [debouncedSubmit]);

  const filteredStreamingSources = isInternational
    ? showStreamingSources
    : showStreamingSources.filter((s) => s.region === "GB");

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    dispatch({ type: "SET_QUERY", payload: query });
    debouncedSubmit(query);
  };

  const handleSelectResult = (
    e: React.MouseEvent<HTMLElement>,
    id: number,
    name: string,
    image: string,
    type: string
  ) => {
    e.preventDefault();
    dispatch({ type: "SELECT_SHOW", payload: { id, name, image, type } });
    fetchSourcesResults(id);

    dispatch({ type: isSaved(id) ? "MARK_ADDED" : "RESET_ADDED" });
  };

  const handleClearSearch = () => {
    dispatch({ type: "CLEAR_RESULTS" });
  };

  const handleCheckboxChange = () => {
    dispatch({ type: "TOGGLE_INTERNATIONAL" });
  };

  const onClickAddRemoveShow = () => {
    if (!showId) return;

    const show = {
      id: showId,
      name: showName,
      image: showImage,
      type: showType,
    };

    if (isSaved(showId)) {
      removeShow(showId);
      dispatch({ type: "RESET_ADDED" });
    } else {
      addShow(show as Show);
      dispatch({ type: "MARK_ADDED" });
    }
  };

  useEffect(() => {
    if (showId != null) {
      dispatch({ type: isSaved(showId) ? "MARK_ADDED" : "RESET_ADDED" });
    }
  }, [showId, isSaved, dispatch]);

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
              showClearResults={searchQuery !== ""}
              handleSubmit={fetchAutoCompleteResults}
              handleClearSearch={handleClearSearch}
            />
            {searchQuery && !isLoading && autoCompleteResults.length > 0 && (
              <SearchResults
                data={autoCompleteResults}
                handleSelectResult={handleSelectResult}
              />
            )}
          </div>
        </div>
      </section>

      {!showName && (
        <div className="max-w-screen-lg mx-auto p-4">
          <MyShows />
          <RecommendShows />
        </div>
      )}

      {showName && (
        <section className="relative bg-black h-screen">
          <div className="relative p-4">
            <div className="flex items-center justify-center">
              {showImage && (
                <Image
                  src={showImage}
                  alt={showName}
                  width={48}
                  height={48}
                  className="inline-block align-middle rounded shadow bg-white mr-4"
                />
              )}
              <div>
                <h2 className="text-2xl text-center font-semibold text-white self-start">
                  {showName}
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
              <div className="flex justify-between py-4">
                <label className="text-sm font-medium text-white dark:text-gray-300 flex gap-2 items-center self-end">
                  <input
                    id="default-checkbox"
                    type="checkbox"
                    onChange={handleCheckboxChange}
                    checked={isInternational}
                  />
                  Show International
                </label>
                <button
                  className={`${
                    isShowAdded ? "bg-red-500" : "bg-green-500"
                  } text-white px-4 py-2 rounded-md flex gap-2 items-center`}
                  onClick={onClickAddRemoveShow}
                  disabled={!showId}
                >
                  {isShowAdded ? (
                    <PlusIcon className="w-4 h-4" />
                  ) : (
                    <TrashIcon className="w-4 h-4" />
                  )}
                  {isShowAdded ? "Remove from my shows" : "Add to my shows"}
                </button>
              </div>
              <ResultsTable data={filteredStreamingSources} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
