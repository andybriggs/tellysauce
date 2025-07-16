import { useReducer } from "react";
import {
  streamingSearchReducer,
  StreamingSearchState,
} from "./useStreamingSearchReducer";

const initialState: StreamingSearchState = {
  searchQuery: "",
  autoCompleteResults: [],
  showTitle: "",
  showImage: undefined,
  showType: undefined,
  showStreamingSources: [],
  isInternational: false,
  isLoading: false,
  isShowAdded: false,
};

export function useStreamingSearch() {
  const [state, dispatch] = useReducer(streamingSearchReducer, initialState);

  // API keys & endpoints
  const API_KEY = process.env.NEXT_PUBLIC_WATCHMODE_API_KEY;
  const AUTO_COMPLETE_API = `https://api.watchmode.com/v1/autocomplete-search/?apiKey=${API_KEY}&search_field=name&search_value=`;
  const STREAM_SOURCE_API = (id: number) =>
    `https://api.watchmode.com/v1/title/${id}/sources/?apiKey=${API_KEY}`;

  // Actions
  const fetchAutoCompleteResults = async (query: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    if (!query) {
      dispatch({ type: "SET_RESULTS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    const res = await fetch(AUTO_COMPLETE_API + query);
    const data = await res.json();
    dispatch({ type: "SET_RESULTS", payload: data.results });
    dispatch({ type: "SET_LOADING", payload: false });
  };

  const fetchSourcesResults = async (id: number) => {
    const res = await fetch(STREAM_SOURCE_API(id));
    const data = await res.json();
    dispatch({ type: "SET_SOURCES", payload: data });
  };

  return {
    state,
    dispatch,
    fetchAutoCompleteResults,
    fetchSourcesResults,
  };
}
