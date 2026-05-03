import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { useRecommendations } from "./useRecommendations";

const fakeItems = [
  {
    title: "Parasite",
    description: "Dark Korean thriller.",
    tags: ["drama", "thriller"],
    year: 2019,
    suggestedMediaType: "movie",
    suggestedTmdbId: 496243,
    poster: "/parasite.jpg",
  },
];

const fakePostRecs = [
  {
    title: "The Matrix",
    description: "A hacker discovers reality.",
    tags: ["sci-fi", "action"],
    year: 1999,
    mediaType: "movie",
    resolvedTmdbId: 603,
    poster: "/matrix.jpg",
  },
];

describe("useRecommendations", () => {
  describe("cache loading on mount", () => {
    it("starts with empty titles", () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        )
      );
      const { result } = renderHook(() => useRecommendations());
      expect(result.current.titles).toEqual([]);
    });

    it("loads cached titles from GET /api/recommendations on mount", async () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: { id: "set-1" }, items: fakeItems })
        )
      );

      const { result } = renderHook(() => useRecommendations());

      await waitFor(() => expect(result.current.titles).toHaveLength(1));
      expect(result.current.titles[0].name).toBe("Parasite");
      expect(result.current.titles[0].id).toBe(496243);
    });

    it("ignores cache items missing tmdbId or mediaType", async () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({
            set: null,
            items: [
              { title: "No ID", suggestedMediaType: "movie", suggestedTmdbId: null },
              { title: "No Type", suggestedTmdbId: 123, suggestedMediaType: null },
              ...fakeItems,
            ],
          })
        )
      );

      const { result } = renderHook(() => useRecommendations());

      await waitFor(() => expect(result.current.titles).toHaveLength(1));
      expect(result.current.titles[0].name).toBe("Parasite");
    });
  });

  describe("key computation", () => {
    it("returns a profile key when no seed is provided", () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        )
      );
      const { result } = renderHook(() => useRecommendations());
      expect(result.current.key).toMatch(/^profile:/);
    });

    it("returns a seed key when seed with tmdbId is provided", () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        )
      );
      const seed = { title: "Breaking Bad", type: "tv" as const, external: { tmdbId: 1396 } };
      const { result } = renderHook(() => useRecommendations({ seed }));
      expect(result.current.key).toBe("seed:tv:1396");
    });
  });

  describe("generate()", () => {
    it("sets isLoading to true while fetching and false after", async () => {
      let resolvePost!: () => void;
      const postPending = new Promise<void>((res) => { resolvePost = res; });

      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        ),
        http.post("/api/recommend", async () => {
          await postPending;
          return HttpResponse.json({ recommendations: fakePostRecs, key: "profile:3" });
        })
      );

      const { result } = renderHook(() => useRecommendations());

      act(() => { result.current.generate({}); });
      await waitFor(() => expect(result.current.isLoading).toBe(true));

      resolvePost();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("populates titles from POST response", async () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        ),
        http.post("/api/recommend", () =>
          HttpResponse.json({ recommendations: fakePostRecs, key: "profile:3" })
        )
      );

      const { result } = renderHook(() => useRecommendations());

      await act(async () => { await result.current.generate({}); });

      expect(result.current.titles).toHaveLength(1);
      expect(result.current.titles[0].name).toBe("The Matrix");
    });

    it("sets paywallError to 'free_exhausted' on 402 subscription_required", async () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        ),
        http.post("/api/recommend", () =>
          HttpResponse.json({ error: "subscription_required" }, { status: 402 })
        )
      );

      const { result } = renderHook(() => useRecommendations());

      await act(async () => { await result.current.generate({}); });

      expect(result.current.paywallError).toBe("free_exhausted");
    });

    it("sets paywallError to 'monthly_limit' on 402 monthly_limit_reached", async () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        ),
        http.post("/api/recommend", () =>
          HttpResponse.json({ error: "monthly_limit_reached" }, { status: 402 })
        )
      );

      const { result } = renderHook(() => useRecommendations());

      await act(async () => { await result.current.generate({}); });

      expect(result.current.paywallError).toBe("monthly_limit");
    });

    it("clearPaywall() resets paywallError to null", async () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        ),
        http.post("/api/recommend", () =>
          HttpResponse.json({ error: "subscription_required" }, { status: 402 })
        )
      );

      const { result } = renderHook(() => useRecommendations());
      await act(async () => { await result.current.generate({}); });
      expect(result.current.paywallError).not.toBeNull();

      act(() => { result.current.clearPaywall(); });
      expect(result.current.paywallError).toBeNull();
    });

    it("does not set titles when response is not ok (non-402)", async () => {
      server.use(
        http.get("/api/recommendations", () =>
          HttpResponse.json({ set: null, items: [] })
        ),
        http.post("/api/recommend", () =>
          HttpResponse.json({ error: "server error" }, { status: 500 })
        )
      );

      const { result } = renderHook(() => useRecommendations());
      await act(async () => { await result.current.generate({}); });

      expect(result.current.titles).toEqual([]);
      expect(result.current.paywallError).toBeNull();
    });
  });
});
