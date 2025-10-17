import { AutoCompleteResult } from "@/types";
import { initialState } from "./useStreamingSearch";

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
      return {
        ...initialState,
      };
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
