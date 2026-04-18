import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { useStreamingSearch, initialState } from "./useStreamingSearch";
import type { AutoCompleteResult } from "@/types";

const mockResults: AutoCompleteResult[] = [
  { id: 1396, name: "Breaking Bad", type: "tv", year: 2008 },
  { id: 550, name: "Fight Club", type: "movie", year: 1999 },
];

describe("useStreamingSearch", () => {
  describe("initial state", () => {
    it("returns the correct initial state", () => {
      const { result } = renderHook(() => useStreamingSearch());
      expect(result.current.state).toEqual(initialState);
    });

    it("starts with empty searchQuery", () => {
      const { result } = renderHook(() => useStreamingSearch());
      expect(result.current.state.searchQuery).toBe("");
    });

    it("starts with empty autoCompleteResults", () => {
      const { result } = renderHook(() => useStreamingSearch());
      expect(result.current.state.autoCompleteResults).toEqual([]);
    });

    it("starts with isLoading false", () => {
      const { result } = renderHook(() => useStreamingSearch());
      expect(result.current.state.isLoading).toBe(false);
    });

    it("starts with isTitleAdded false", () => {
      const { result } = renderHook(() => useStreamingSearch());
      expect(result.current.state.isTitleAdded).toBe(false);
    });
  });

  describe("dispatch", () => {
    it("SET_QUERY updates searchQuery and resets other fields", () => {
      const { result } = renderHook(() => useStreamingSearch());

      act(() => {
        result.current.dispatch({ type: "SET_QUERY", payload: "breaking bad" });
      });

      expect(result.current.state.searchQuery).toBe("breaking bad");
      expect(result.current.state.autoCompleteResults).toEqual([]);
      expect(result.current.state.isLoading).toBe(false);
    });

    it("CLEAR_RESULTS resets state to initialState", () => {
      const { result } = renderHook(() => useStreamingSearch());

      act(() => {
        result.current.dispatch({ type: "SET_QUERY", payload: "some query" });
      });
      act(() => {
        result.current.dispatch({ type: "CLEAR_RESULTS" });
      });

      expect(result.current.state).toEqual(initialState);
    });

    it("MARK_ADDED sets isTitleAdded to true", () => {
      const { result } = renderHook(() => useStreamingSearch());

      act(() => {
        result.current.dispatch({ type: "MARK_ADDED" });
      });

      expect(result.current.state.isTitleAdded).toBe(true);
    });

    it("RESET_ADDED sets isTitleAdded to false", () => {
      const { result } = renderHook(() => useStreamingSearch());

      act(() => {
        result.current.dispatch({ type: "MARK_ADDED" });
      });
      act(() => {
        result.current.dispatch({ type: "RESET_ADDED" });
      });

      expect(result.current.state.isTitleAdded).toBe(false);
    });
  });

  describe("fetchAutoCompleteResults", () => {
    it("fetches and sets results for a valid query", async () => {
      server.use(
        http.get("/api/autocomplete", () =>
          HttpResponse.json({ results: mockResults })
        )
      );

      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("breaking");
      });

      expect(result.current.state.autoCompleteResults).toEqual(mockResults);
      expect(result.current.state.isLoading).toBe(false);
    });

    it("sends the query as a URL parameter", async () => {
      let capturedQ: string | null = null;
      server.use(
        http.get("/api/autocomplete", ({ request }) => {
          const url = new URL(request.url);
          capturedQ = url.searchParams.get("q");
          return HttpResponse.json({ results: mockResults });
        })
      );

      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("breaking bad");
      });

      expect(capturedQ).toBe("breaking bad");
    });

    it("sets isLoading to false after fetch completes", async () => {
      server.use(
        http.get("/api/autocomplete", () =>
          HttpResponse.json({ results: mockResults })
        )
      );

      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("query");
      });

      expect(result.current.state.isLoading).toBe(false);
    });

    it("sets empty results and stops loading for empty/whitespace query", async () => {
      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("   ");
      });

      expect(result.current.state.autoCompleteResults).toEqual([]);
      expect(result.current.state.isLoading).toBe(false);
    });

    it("sets empty results and stops loading for empty string", async () => {
      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("");
      });

      expect(result.current.state.autoCompleteResults).toEqual([]);
      expect(result.current.state.isLoading).toBe(false);
    });

    it("sets empty results when API returns non-OK response", async () => {
      server.use(
        http.get("/api/autocomplete", () =>
          HttpResponse.json({}, { status: 500 })
        )
      );

      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("query");
      });

      expect(result.current.state.autoCompleteResults).toEqual([]);
      expect(result.current.state.isLoading).toBe(false);
    });

    it("sets empty results when fetch throws (network error)", async () => {
      server.use(
        http.get("/api/autocomplete", () => HttpResponse.error())
      );

      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("query");
      });

      expect(result.current.state.autoCompleteResults).toEqual([]);
      expect(result.current.state.isLoading).toBe(false);
    });

    it("handles API returning null results gracefully", async () => {
      server.use(
        http.get("/api/autocomplete", () =>
          HttpResponse.json({ results: null })
        )
      );

      const { result } = renderHook(() => useStreamingSearch());

      await act(async () => {
        await result.current.fetchAutoCompleteResults("query");
      });

      expect(result.current.state.autoCompleteResults).toEqual([]);
    });
  });
});
