import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement } from "react";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { useWatchList } from "./useWatchList";
import type { Title } from "@/types";

const mockTitle: Title = {
  id: 1396,
  name: "Breaking Bad",
  poster: "/poster.jpg",
  type: "tv",
  rating: 0,
  description: "A teacher turns cook.",
  year: 2008,
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

describe("useWatchList", () => {
  it("returns empty watchList initially while loading", () => {
    const { result } = renderHook(() => useWatchList(), { wrapper });
    expect(result.current.watchList).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("fetches watchlist on mount and returns titles", async () => {
    server.use(
      http.get("/api/watchlist", () =>
        HttpResponse.json([mockTitle])
      )
    );

    const { result } = renderHook(() => useWatchList(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.watchList).toHaveLength(1);
    expect(result.current.watchList[0].name).toBe("Breaking Bad");
  });

  it("returns error state when fetch fails", async () => {
    server.use(
      http.get("/api/watchlist", () => HttpResponse.json({}, { status: 500 }))
    );

    const { result } = renderHook(() => useWatchList(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.watchList).toEqual([]);
  });

  it("hasMounted is always true", async () => {
    const { result } = renderHook(() => useWatchList(), { wrapper });
    expect(result.current.hasMounted).toBe(true);
  });

  describe("isSaved", () => {
    it("returns false when id is not in the list", async () => {
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([mockTitle]))
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isSaved(9999, "tv")).toBe(false);
    });

    it("returns true when id + type matches", async () => {
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([mockTitle]))
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isSaved(1396, "tv")).toBe(true);
    });

    it("returns false when id matches but type does not", async () => {
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([mockTitle]))
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isSaved(1396, "movie")).toBe(false);
    });

    it("returns false when called without an id", async () => {
      const { result } = renderHook(() => useWatchList(), { wrapper });
      expect(result.current.isSaved(undefined, "tv")).toBe(false);
    });
  });

  describe("add", () => {
    it("calls POST /api/watchlist with id + type and then mutates", async () => {
      let postedBody: unknown;
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([])),
        http.post("/api/watchlist", async ({ request }) => {
          postedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.add(1396, "tv");
      });

      expect(postedBody).toEqual({ tmdbId: 1396, mediaType: "tv" });
    });

    it("calls POST /api/watchlist with a title object", async () => {
      let postedBody: unknown;
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([])),
        http.post("/api/watchlist", async ({ request }) => {
          postedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.add(mockTitle);
      });

      expect(postedBody).toEqual({ tmdbId: 1396, mediaType: "tv" });
    });

    it("throws when called with a numeric id but no mediaType", async () => {
      server.use(http.get("/api/watchlist", () => HttpResponse.json([])));

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.add(1396);
        })
      ).rejects.toThrow();
    });
  });

  describe("remove", () => {
    it("calls DELETE /api/watchlist with id + type and then mutates", async () => {
      let deletedBody: unknown;
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([mockTitle])),
        http.delete("/api/watchlist", async ({ request }) => {
          deletedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.remove(1396, "tv");
      });

      expect(deletedBody).toEqual({ tmdbId: 1396, mediaType: "tv" });
    });
  });

  describe("toggle", () => {
    it("calls add (POST) when title is not in watchlist", async () => {
      let postCalled = false;
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([])),
        http.post("/api/watchlist", () => {
          postCalled = true;
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggle(mockTitle);
      });

      expect(postCalled).toBe(true);
    });

    it("calls remove (DELETE) when title is already in watchlist", async () => {
      let deleteCalled = false;
      server.use(
        http.get("/api/watchlist", () => HttpResponse.json([mockTitle])),
        http.delete("/api/watchlist", () => {
          deleteCalled = true;
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useWatchList(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggle(mockTitle);
      });

      expect(deleteCalled).toBe(true);
    });
  });
});
