import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement } from "react";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { useDiscoverTitles } from "./useDiscoverTitles";
import type { Title } from "@/types";

const mockMovie: Title = {
  id: 550,
  name: "Fight Club",
  poster: "/poster.jpg",
  type: "movie",
  rating: 0,
  description: "An insomniac forms a fight club.",
  year: 1999,
};

const mockTvShow: Title = {
  id: 1396,
  name: "Breaking Bad",
  poster: "/poster.jpg",
  type: "tv",
  rating: 0,
  description: "Chemistry teacher turned drug manufacturer.",
  year: 2008,
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

describe("useDiscoverTitles", () => {
  it("fetches movies with default params when no type provided", async () => {
    server.use(
      http.get("/api/discover", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("type") === "movie") {
          return HttpResponse.json({ titles: [mockMovie] });
        }
        return HttpResponse.json({ titles: [] });
      })
    );

    const { result } = renderHook(() => useDiscoverTitles(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.titles).toHaveLength(1);
    expect(result.current.titles[0].name).toBe("Fight Club");
  });

  it("fetches movies when type is 'movie'", async () => {
    server.use(
      http.get("/api/discover", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("type") === "movie") {
          return HttpResponse.json({ titles: [mockMovie] });
        }
        return HttpResponse.json({ titles: [] });
      })
    );

    const { result } = renderHook(() => useDiscoverTitles("movie"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.titles).toHaveLength(1);
    expect(result.current.titles[0].id).toBe(550);
  });

  it("fetches TV shows when type is 'tv'", async () => {
    server.use(
      http.get("/api/discover", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("type") === "tv") {
          return HttpResponse.json({ titles: [mockTvShow] });
        }
        return HttpResponse.json({ titles: [] });
      })
    );

    const { result } = renderHook(() => useDiscoverTitles("tv"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.titles).toHaveLength(1);
    expect(result.current.titles[0].name).toBe("Breaking Bad");
  });

  it("appends timeframe param when option is provided", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get("/api/discover", ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({ titles: [mockMovie] });
      })
    );

    const { result } = renderHook(
      () => useDiscoverTitles("movie", { timeframe: "recent" }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl?.searchParams.get("timeframe")).toBe("recent");
  });

  it("appends source=ai param when source option is 'ai'", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get("/api/discover", ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({ titles: [mockMovie] });
      })
    );

    const { result } = renderHook(
      () => useDiscoverTitles("movie", { source: "ai" }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl?.searchParams.get("source")).toBe("ai");
  });

  it("does not append source param when source is not provided", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get("/api/discover", ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({ titles: [] });
      })
    );

    const { result } = renderHook(() => useDiscoverTitles("movie"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl?.searchParams.has("source")).toBe(false);
  });

  it("returns empty titles array on error", async () => {
    server.use(
      http.get("/api/discover", () => HttpResponse.json({}, { status: 500 }))
    );

    const { result } = renderHook(() => useDiscoverTitles("movie"), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.titles).toEqual([]);
  });

  it("returns isLoading true initially", () => {
    const { result } = renderHook(() => useDiscoverTitles("movie"), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("returns empty titles when response has no titles field", async () => {
    server.use(
      http.get("/api/discover", () => HttpResponse.json({}))
    );

    const { result } = renderHook(() => useDiscoverTitles("movie"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.titles).toEqual([]);
  });
});
