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
import useIsLoggedIn from "@/hooks/useIsLoggedIn";
import PopularTitles from "@/components/PopularTitles";

export default function Home() {
  const { state, dispatch, fetchAutoCompleteResults } = useStreamingSearch();

  const isLoggedIn = useIsLoggedIn();

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

      {!isLoggedIn && (
        <div className="flex flex-col items-center px-4 mt-10">
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-[1px] shadow-2xl w-full max-w-screen-xl">
            <div className="bg-gray-900 rounded-3xl p-8 flex flex-col items-center text-center">
              <h1 className="text-3xl font-extrabold text-white mb-4">
                Welcome!👋
              </h1>
              <p className="text-gray-300 mb-8">
                Log in to access{" "}
                <span className="text-indigo-400 font-semibold">
                  AI-powered recommendations
                </span>
                , personalized watchlists, and all your rated shows.
              </p>
              <AuthButton />
            </div>
          </div>
        </div>
      )}
      <div className="max-w-screen-xl mx-auto p-8">
        <PopularTitles />
        <PopularTitles type="tv" />
        {isLoggedIn && (
          <>
            <Watchlist />
            <RatedTitles />
            <RecommendTitles />
          </>
        )}
      </div>
    </>
  );
}
