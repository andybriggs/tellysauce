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

  it("re-ranks by title match across both pages and drops duplicates", async () => {
    const pagesRequested: string[] = [];
    server.use(
      http.get("https://api.themoviedb.org/3/search/multi", ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        pagesRequested.push(page);
        const results =
          page === "1"
            ? [
                { id: 1, media_type: "tv", name: "Jake and the Never Land Pirates", vote_count: 67 },
                { id: 2, media_type: "movie", title: "Pirates of the Caribbean", vote_count: 23102 },
              ]
            : [
                { id: 2, media_type: "movie", title: "Pirates of the Caribbean", vote_count: 23102 },
                { id: 3, media_type: "movie", title: "The Pirates! In an Adventure with Scientists!", vote_count: 1273 },
              ];
        return HttpResponse.json({ results });
      })
    );

    const res = await GET(new NextRequest("http://localhost/api/autocomplete?q=The+Pirates!"));
    const data = await res.json();
    expect(pagesRequested.sort()).toEqual(["1", "2"]);
    expect(data.results.map((r: { id: number }) => r.id)).toEqual([3, 2, 1]);
  });

  it("still returns page 1 when page 2 fails", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/multi", ({ request }) =>
        new URL(request.url).searchParams.get("page") === "2"
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ results: [{ id: 7, media_type: "movie", title: "Dune" }] })
      )
    );

    const res = await GET(new NextRequest("http://localhost/api/autocomplete?q=dune"));
    expect(res.status).toBe(200);
    expect((await res.json()).results.map((r: { id: number }) => r.id)).toEqual([7]);
  });
});
