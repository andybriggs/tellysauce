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

describe("GET /api/autocomplete", () => {
  it("returns empty results for empty query", async () => {
    const req = new NextRequest("http://localhost/api/autocomplete?q=");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it("returns empty results when q is missing", async () => {
    const req = new NextRequest("http://localhost/api/autocomplete");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it("returns 500 when TMDB_ACCESS_TOKEN is missing", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "");
    const req = new NextRequest("http://localhost/api/autocomplete?q=batman");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("returns search results for a query", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/multi", () =>
        HttpResponse.json({
          results: [
            {
              id: 272,
              media_type: "movie",
              title: "Batman Begins",
              release_date: "2005-06-15",
              poster_path: "/poster.jpg",
              backdrop_path: "/backdrop.jpg",
            },
            {
              id: 1,
              media_type: "person",
              name: "Christian Bale",
            },
          ],
        })
      )
    );

    const req = new NextRequest("http://localhost/api/autocomplete?q=batman");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    // persons are filtered out
    expect(data.results).toHaveLength(1);
    expect(data.results[0].name).toBe("Batman Begins");
    expect(data.results[0].type).toBe("movie");
    expect(data.results[0].year).toBe(2005);
  });

  it("returns TV show results with correct type", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/multi", () =>
        HttpResponse.json({
          results: [
            {
              id: 1399,
              media_type: "tv",
              name: "Game of Thrones",
              first_air_date: "2011-04-17",
              poster_path: null,
              backdrop_path: null,
            },
          ],
        })
      )
    );

    const req = new NextRequest("http://localhost/api/autocomplete?q=game+of+thrones");
    const res = await GET(req);
    const data = await res.json();
    expect(data.results[0].type).toBe("tv");
    expect(data.results[0].year).toBe(2011);
  });

  it("returns error when TMDB responds with non-ok status", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/multi", () =>
        new HttpResponse(null, { status: 401 })
      )
    );

    const req = new NextRequest("http://localhost/api/autocomplete?q=batman");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 502 on network error", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/multi", () =>
        HttpResponse.error()
      )
    );

    const req = new NextRequest("http://localhost/api/autocomplete?q=batman");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });
});
