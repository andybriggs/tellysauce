"use client";

import { useMemo, useEffect } from "react";
import { debounce } from "lodash";
import { useStreamingSearch } from "./hooks/useStreamingSearch";
import Hero from "./components/Hero";
import Search from "./components/Search";
import SearchResults from "./components/SearchResults";
import MyRatedShows from "./components/MyRatedShows";
import RecommendShows from "./components/RecommendShows";
import { useRouter } from "next/navigation";

export default function Home() {
  const { state, dispatch, fetchAutoCompleteResults } = useStreamingSearch();

  const router = useRouter();

  const { searchQuery, autoCompleteResults, isLoading } = state;

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

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    dispatch({ type: "SET_QUERY", payload: query });
    debouncedSubmit(query);
  };

  const handleSelectResult = (e: React.MouseEvent<HTMLElement>, id: number) => {
    e.preventDefault();
    router.push(`/title/${id}`);
  };

  const handleClearSearch = () => {
    dispatch({ type: "CLEAR_RESULTS" });
  };

  return (
    <>
      <section className="w-full bg-amber-50 relative z-10">
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
            {searchQuery && !isLoading && (
              <SearchResults
                data={autoCompleteResults}
                handleSelectResult={handleSelectResult}
              />
            )}
          </div>
        </div>
      </section>

      <div className="max-w-screen-lg mx-auto p-8">
        <MyRatedShows />
        <RecommendShows />
      </div>
    </>
  );
}
