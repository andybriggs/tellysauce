"use client";

import { debounce } from "lodash";
import { useEffect, useMemo } from "react";
import Hero from "@/components/Hero";
import RatedTitles from "@/components/RatedTitles";
import RecommendTitles from "@/components/recommendations/RecommendTitles";
import Search from "@/components/Search";
import SearchResults from "@/components/SearchResults";
import Watchlist from "@/components/Watchlist";
import { useStreamingSearch } from "@/hooks/useStreamingSearch";
import AuthButton from "@/components/AuthButton";
import Container from "@/components/Container";

export default function Home() {
  const { state, dispatch, fetchAutoCompleteResults } = useStreamingSearch();

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

  const handleClearSearch = () => {
    dispatch({ type: "CLEAR_RESULTS" });
  };

  return (
    <>
      <section className="relative w-full z-10">
        <div
          className="
      absolute inset-0
      bg-[url('/bg1.png')] bg-repeat
      bg-[length:220px_220px] sm:bg-[length:240px_240px] md:bg-[length:280px_280px]
    "
        />
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80" />
        <Container>
          <div className="flex p-4 justify-end relative z-11">
            <AuthButton />
          </div>
        </Container>
        <div className="relative px-6 py-20 text-center isolate sm:px-16 ">
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
              <SearchResults data={autoCompleteResults} />
            )}
          </div>
        </div>
      </section>

      <div className="max-w-screen-lg mx-auto p-8">
        <RatedTitles />
        <Watchlist />
        <RecommendTitles />
      </div>
    </>
  );
}
