"use client";

import { useReducer } from "react";
import { AutoCompleteResult } from "@/types";

/* ---------- State & Actions ---------- */

export type StreamingSearchState = {
  searchQuery: string;
  autoCompleteResults: AutoCompleteResult[];
  titleName: string;
  titleId?: number;
  titleType?: string;
  isLoading: boolean;
  isTitleAdded: boolean;
};

export type StreamingSearchAction =
  | { type: "SET_QUERY"; payload: string }
  | { type: "SET_RESULTS"; payload: AutoCompleteResult[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_RESULTS" }
  | { type: "MARK_ADDED" }
  | { type: "RESET_ADDED" }
  | { type: "SET_ADDED_STATE"; payload: boolean };

export const initialState: StreamingSearchState = {
  searchQuery: "",
  autoCompleteResults: [],
  titleId: undefined,
  titleName: "",
  titleType: undefined,
  isLoading: false,
  isTitleAdded: false,
};

export function streamingSearchReducer(
  state: StreamingSearchState,
  action: StreamingSearchAction
): StreamingSearchState {
  switch (action.type) {
    case "SET_QUERY":
      return { ...initialState, searchQuery: action.payload };
    case "SET_RESULTS":
      return { ...state, autoCompleteResults: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "CLEAR_RESULTS":
      return { ...initialState };
    case "MARK_ADDED":
      return { ...state, isTitleAdded: true };
    case "RESET_ADDED":
      return { ...state, isTitleAdded: false };
    case "SET_ADDED_STATE":
      return { ...state, isTitleAdded: action.payload };
    default:
      return state;
  }
}

/* ---------- Hook ---------- */

export function useStreamingSearch() {
  const [state, dispatch] = useReducer(streamingSearchReducer, initialState);

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
        { method: "GET" }
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

  return { state, dispatch, fetchAutoCompleteResults };
}
