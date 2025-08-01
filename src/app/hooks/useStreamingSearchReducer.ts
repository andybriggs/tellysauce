import { AutoCompleteResult, StreamingSource } from "@/app/types";
import { initialState } from "./useStreamingSearch";

export type StreamingSearchState = {
  searchQuery: string;
  autoCompleteResults: AutoCompleteResult[];
  showName: string;
  showId?: number;
  showImage?: string;
  showType?: string;
  showStreamingSources: StreamingSource[];
  isInternational: boolean;
  isLoading: boolean;
  isShowAdded: boolean;
};

export type StreamingSearchAction =
  | { type: "SET_QUERY"; payload: string }
  | { type: "SET_RESULTS"; payload: AutoCompleteResult[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_RESULTS" }
  | {
      type: "SELECT_SHOW";
      payload: {
        id: number;
        name: string;
        image: string;
        type: string;
      };
    }
  | { type: "SET_SOURCES"; payload: StreamingSource[] }
  | { type: "TOGGLE_INTERNATIONAL" }
  | { type: "ADD_TO_MY_SHOWS" }
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
    case "SELECT_SHOW":
      return {
        ...state,
        showId: action.payload.id,
        showName: action.payload.name,
        showImage: action.payload.image,
        showType: action.payload.type,
        autoCompleteResults: [],
      };
    case "SET_SOURCES":
      return { ...state, showStreamingSources: action.payload };
    case "TOGGLE_INTERNATIONAL":
      return { ...state, isInternational: !state.isInternational };
    case "MARK_ADDED":
      return { ...state, isShowAdded: true };
    case "RESET_ADDED":
      return { ...state, isShowAdded: false };
    case "SET_ADDED_STATE":
      return { ...state, isShowAdded: action.payload };
    default:
      return state;
  }
}
