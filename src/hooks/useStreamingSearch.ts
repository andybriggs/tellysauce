import { useReducer } from "react";
import {
  streamingSearchReducer,
  StreamingSearchState,
} from "./useStreamingSearchReducer";

export const initialState: StreamingSearchState = {
  searchQuery: "",
  autoCompleteResults: [],
  titleId: undefined,
  titleName: "",
  titleType: undefined,
  isLoading: false,
  isTitleAdded: false,
};

export function useStreamingSearch() {
  const [state, dispatch] = useReducer(streamingSearchReducer, initialState);

  // Actions
  const fetchAutoCompleteResults = async (query: string) => {
    dispatch({ type: "SET_LOADING", payload: true });

    const trimmed = query?.trim() ?? "";
    if (!trimmed) {
      dispatch({ type: "SET_RESULTS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    try {
      const res = await fetch(
        `/api/autocomplete?q=${encodeURIComponent(trimmed)}`,
        {
          method: "GET",
        }
      );

      if (!res.ok) {
        dispatch({ type: "SET_RESULTS", payload: [] });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      const data = await res.json();
      dispatch({ type: "SET_RESULTS", payload: data?.results ?? [] });
    } catch {
      dispatch({ type: "SET_RESULTS", payload: [] });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  return {
    state,
    dispatch,
    fetchAutoCompleteResults,
  };
}
