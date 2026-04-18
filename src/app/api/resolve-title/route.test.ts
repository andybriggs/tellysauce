import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";

import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/resolve-title", () => {
  it("returns 400 when q and imdbId both missing", async () => {
    const req = new NextRequest("http://localhost/api/resolve-title");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing q/);
  });

  it("returns 500 when TMDB_ACCESS_TOKEN not configured", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "");
    const req = new NextRequest("http://localhost/api/resolve-title?q=Fight+Club");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("resolves a title by text search via exact match", async () => {
    const movieResult = {
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      overview: "First rule.",
      poster_path: "/poster.jpg",
      backdrop_path: null,
      popularity: 100,
      vote_count: 10000,
    };

    // Movie search endpoint returns Fight Club
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({ results: [movieResult] })
      ),
      http.get("https://api.themoviedb.org/3/search/tv", () =>
        HttpResponse.json({ results: [] })
      )
    );

    const req = new NextRequest(
      "http://localhost/api/resolve-title?q=Fight+Club&year=1999&kind=movie"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    // Exact match should be found (id and kind set)
    expect(data.id).toBe(550);
    expect(data.kind).toBe("movie");
  });

  it("returns id:null when no results found", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({ results: [] })
      ),
      http.get("https://api.themoviedb.org/3/search/tv", () =>
        HttpResponse.json({ results: [] })
      )
    );

    const req = new NextRequest(
      "http://localhost/api/resolve-title?q=ThisTitleDoesNotExistAtAll12345"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeNull();
    expect(data.results).toEqual([]);
  });

  it("resolves by IMDb ID via /find endpoint", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/find/tt0137523", () =>
        HttpResponse.json({
          movie_results: [
            {
              id: 550,
              title: "Fight Club",
              release_date: "1999-10-15",
              overview: "First rule.",
              poster_path: "/poster.jpg",
              backdrop_path: null,
              popularity: 100,
              vote_count: 10000,
            },
          ],
          tv_results: [],
        })
      )
    );

    const req = new NextRequest(
      "http://localhost/api/resolve-title?imdbId=tt0137523"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(550);
    expect(data.kind).toBe("movie");
  });
});
