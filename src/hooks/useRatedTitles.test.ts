import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement } from "react";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { useRatedTitles } from "./useRatedTitles";
import type { Title } from "@/types";

const mockRatedTitle: Title = {
  id: 1396,
  name: "Breaking Bad",
  poster: "/poster.jpg",
  type: "tv",
  rating: 5,
  description: "Chemistry teacher turned drug manufacturer.",
  year: 2008,
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

describe("useRatedTitles", () => {
  it("returns empty ratedTitles initially while loading", () => {
    const { result } = renderHook(() => useRatedTitles(), { wrapper });
    expect(result.current.ratedTitles).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("fetches rated titles on mount and returns them", async () => {
    server.use(
      http.get("/api/rated", () => HttpResponse.json([mockRatedTitle]))
    );

    const { result } = renderHook(() => useRatedTitles(), { wrapper });
    await waitFor(() => expect(result.current.ratedTitles).toHaveLength(1));
    expect(result.current.ratedTitles[0].name).toBe("Breaking Bad");
  });

  it("returns error when fetch fails", async () => {
    server.use(
      http.get("/api/rated", () => HttpResponse.json({}, { status: 500 }))
    );

    const { result } = renderHook(() => useRatedTitles(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.ratedTitles).toEqual([]);
  });

  it("hasMounted is always true", () => {
    const { result } = renderHook(() => useRatedTitles(), { wrapper });
    expect(result.current.hasMounted).toBe(true);
  });

  describe("isSaved", () => {
    it("returns true when id is in rated list", async () => {
      server.use(
        http.get("/api/rated", () => HttpResponse.json([mockRatedTitle]))
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.ratedTitles).toHaveLength(1));

      expect(result.current.isSaved(1396)).toBe(true);
    });

    it("returns false when id is not in rated list", async () => {
      server.use(
        http.get("/api/rated", () => HttpResponse.json([mockRatedTitle]))
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.ratedTitles).toHaveLength(1));

      expect(result.current.isSaved(9999)).toBe(false);
    });

    it("returns false when id is undefined", async () => {
      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      expect(result.current.isSaved(undefined)).toBe(false);
    });
  });

  describe("getRating", () => {
    it("returns the rating for a rated title", async () => {
      server.use(
        http.get("/api/rated", () => HttpResponse.json([mockRatedTitle]))
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.ratedTitles).toHaveLength(1));

      expect(result.current.getRating(1396)).toBe(5);
    });

    it("returns 0 when title is not rated", async () => {
      server.use(
        http.get("/api/rated", () => HttpResponse.json([mockRatedTitle]))
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.ratedTitles).toHaveLength(1));

      expect(result.current.getRating(9999)).toBe(0);
    });
  });

  describe("rateTitle", () => {
    it("calls POST /api/rated with correct body", async () => {
      let postedBody: unknown;
      server.use(
        http.get("/api/rated", () => HttpResponse.json([])),
        http.post("/api/rated", async ({ request }) => {
          postedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.rateTitle(1396, "tv", 4);
      });

      expect(postedBody).toEqual({ tmdbId: 1396, mediaType: "tv", rating: 4 });
    });

    it("clamps rating to 5 when above 5", async () => {
      let postedBody: unknown;
      server.use(
        http.get("/api/rated", () => HttpResponse.json([])),
        http.post("/api/rated", async ({ request }) => {
          postedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.rateTitle(1396, "tv", 10);
      });

      expect((postedBody as { rating: number }).rating).toBe(5);
    });

    it("clamps rating to 1 when below 1", async () => {
      let postedBody: unknown;
      server.use(
        http.get("/api/rated", () => HttpResponse.json([])),
        http.post("/api/rated", async ({ request }) => {
          postedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.rateTitle(1396, "tv", 0);
      });

      expect((postedBody as { rating: number }).rating).toBe(1);
    });

    it("tracks submission state: isSubmittingId is true during submission", async () => {
      let resolvePost: () => void;
      const postPromise = new Promise<void>((res) => {
        resolvePost = res;
      });

      server.use(
        http.get("/api/rated", () => HttpResponse.json([])),
        http.post("/api/rated", async () => {
          await postPromise;
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Start rating without awaiting
      act(() => {
        result.current.rateTitle(1396, "tv", 4);
      });

      // While the POST is in flight, isSubmittingId should be true
      await waitFor(() => expect(result.current.isSubmittingId(1396)).toBe(true));

      // Resolve the POST
      act(() => resolvePost!());

      // After POST completes, submission flag should be cleared
      await waitFor(() => expect(result.current.isSubmittingId(1396)).toBe(false));
    });

    it("clears submitting state even when POST fails", async () => {
      server.use(
        http.get("/api/rated", () => HttpResponse.json([])),
        http.post("/api/rated", () => HttpResponse.json({}, { status: 500 }))
      );

      const { result } = renderHook(() => useRatedTitles(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        // rateTitle doesn't rethrow on mutate failure — just wait for it to settle
        try {
          await result.current.rateTitle(1396, "tv", 3);
        } catch {
          // ignore
        }
      });

      expect(result.current.isSubmittingId(1396)).toBe(false);
    });
  });
});
