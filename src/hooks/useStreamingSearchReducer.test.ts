import { describe, it, expect } from "vitest";
import {
  streamingSearchReducer,
  StreamingSearchState,
} from "./useStreamingSearchReducer";
import { initialState } from "./useStreamingSearch";

// Helper: produce a custom state for testing transitions
function makeState(overrides: Partial<StreamingSearchState> = {}): StreamingSearchState {
  return { ...initialState, ...overrides };
}

describe("streamingSearchReducer", () => {
  describe("SET_QUERY", () => {
    it("resets to initialState and sets searchQuery", () => {
      const state = makeState({
        searchQuery: "old query",
        autoCompleteResults: [{ id: 1, name: "Old", type: "movie" }],
        isLoading: true,
        isTitleAdded: true,
      });

      const next = streamingSearchReducer(state, {
        type: "SET_QUERY",
        payload: "new query",
      });

      expect(next.searchQuery).toBe("new query");
      expect(next.autoCompleteResults).toEqual([]);
      expect(next.isLoading).toBe(false);
      expect(next.isTitleAdded).toBe(false);
      expect(next.titleId).toBeUndefined();
      expect(next.titleType).toBeUndefined();
      expect(next.titleName).toBe("");
    });

    it("allows setting an empty query string", () => {
      const state = makeState({ searchQuery: "something" });
      const next = streamingSearchReducer(state, { type: "SET_QUERY", payload: "" });
      expect(next.searchQuery).toBe("");
    });
  });

  describe("SET_RESULTS", () => {
    it("sets autoCompleteResults without changing other state", () => {
      const results = [
        { id: 1396, name: "Breaking Bad", type: "tv" as const, year: 2008 },
      ];
      const state = makeState({ searchQuery: "breaking", isLoading: true });

      const next = streamingSearchReducer(state, {
        type: "SET_RESULTS",
        payload: results,
      });

      expect(next.autoCompleteResults).toEqual(results);
      expect(next.searchQuery).toBe("breaking");
      expect(next.isLoading).toBe(true);
    });

    it("accepts an empty results array", () => {
      const state = makeState({
        autoCompleteResults: [{ id: 1, name: "Old", type: "movie" }],
      });

      const next = streamingSearchReducer(state, {
        type: "SET_RESULTS",
        payload: [],
      });

      expect(next.autoCompleteResults).toEqual([]);
    });
  });

  describe("SET_LOADING", () => {
    it("sets isLoading to true", () => {
      const state = makeState({ isLoading: false });
      const next = streamingSearchReducer(state, {
        type: "SET_LOADING",
        payload: true,
      });
      expect(next.isLoading).toBe(true);
    });

    it("sets isLoading to false", () => {
      const state = makeState({ isLoading: true });
      const next = streamingSearchReducer(state, {
        type: "SET_LOADING",
        payload: false,
      });
      expect(next.isLoading).toBe(false);
    });

    it("does not change other fields", () => {
      const state = makeState({ searchQuery: "hello", isTitleAdded: true });
      const next = streamingSearchReducer(state, {
        type: "SET_LOADING",
        payload: true,
      });
      expect(next.searchQuery).toBe("hello");
      expect(next.isTitleAdded).toBe(true);
    });
  });

  describe("CLEAR_RESULTS", () => {
    it("resets to initial state completely", () => {
      const state = makeState({
        searchQuery: "some search",
        autoCompleteResults: [{ id: 1, name: "X", type: "movie" }],
        isLoading: true,
        isTitleAdded: true,
        titleId: 42,
        titleType: "movie",
        titleName: "Something",
      });

      const next = streamingSearchReducer(state, { type: "CLEAR_RESULTS" });

      expect(next).toEqual(initialState);
    });

    it("does not mutate the original state", () => {
      const state = makeState({ searchQuery: "query" });
      const stateCopy = { ...state };

      streamingSearchReducer(state, { type: "CLEAR_RESULTS" });

      expect(state).toEqual(stateCopy);
    });
  });

  describe("MARK_ADDED", () => {
    it("sets isTitleAdded to true", () => {
      const state = makeState({ isTitleAdded: false });
      const next = streamingSearchReducer(state, { type: "MARK_ADDED" });
      expect(next.isTitleAdded).toBe(true);
    });

    it("is idempotent when already true", () => {
      const state = makeState({ isTitleAdded: true });
      const next = streamingSearchReducer(state, { type: "MARK_ADDED" });
      expect(next.isTitleAdded).toBe(true);
    });

    it("preserves other state fields", () => {
      const state = makeState({ searchQuery: "test", isLoading: true });
      const next = streamingSearchReducer(state, { type: "MARK_ADDED" });
      expect(next.searchQuery).toBe("test");
      expect(next.isLoading).toBe(true);
    });
  });

  describe("RESET_ADDED", () => {
    it("sets isTitleAdded to false", () => {
      const state = makeState({ isTitleAdded: true });
      const next = streamingSearchReducer(state, { type: "RESET_ADDED" });
      expect(next.isTitleAdded).toBe(false);
    });

    it("is idempotent when already false", () => {
      const state = makeState({ isTitleAdded: false });
      const next = streamingSearchReducer(state, { type: "RESET_ADDED" });
      expect(next.isTitleAdded).toBe(false);
    });

    it("preserves other state fields", () => {
      const state = makeState({ searchQuery: "still here", isTitleAdded: true });
      const next = streamingSearchReducer(state, { type: "RESET_ADDED" });
      expect(next.searchQuery).toBe("still here");
    });
  });

  describe("SET_ADDED_STATE", () => {
    it("sets isTitleAdded to true when payload is true", () => {
      const state = makeState({ isTitleAdded: false });
      const next = streamingSearchReducer(state, {
        type: "SET_ADDED_STATE",
        payload: true,
      });
      expect(next.isTitleAdded).toBe(true);
    });

    it("sets isTitleAdded to false when payload is false", () => {
      const state = makeState({ isTitleAdded: true });
      const next = streamingSearchReducer(state, {
        type: "SET_ADDED_STATE",
        payload: false,
      });
      expect(next.isTitleAdded).toBe(false);
    });

    it("preserves other state fields", () => {
      const state = makeState({ searchQuery: "preserved", isLoading: true });
      const next = streamingSearchReducer(state, {
        type: "SET_ADDED_STATE",
        payload: true,
      });
      expect(next.searchQuery).toBe("preserved");
      expect(next.isLoading).toBe(true);
    });
  });

  describe("unknown action", () => {
    it("returns the current state unchanged for unrecognised action types", () => {
      const state = makeState({ searchQuery: "unchanged" });
      // Cast to any to simulate an unknown action type at runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = streamingSearchReducer(state, { type: "UNKNOWN_ACTION" } as any);
      expect(next).toEqual(state);
    });
  });

  describe("state immutability", () => {
    it("does not mutate the input state object", () => {
      const state = makeState({ isLoading: false });
      const frozen = Object.freeze(state);

      // None of these should throw (they all spread, not mutate)
      expect(() =>
        streamingSearchReducer(frozen, { type: "SET_LOADING", payload: true })
      ).not.toThrow();

      expect(() =>
        streamingSearchReducer(frozen, { type: "MARK_ADDED" })
      ).not.toThrow();
    });
  });
});
