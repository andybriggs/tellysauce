import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";

// ---- Mocks ----
vi.mock("@/db", () => ({
  db: { execute: vi.fn() },
}));
vi.mock("@/server/tmdb", () => ({
  TMDB_BASE: "https://api.themoviedb.org/3",
}));

import { db } from "@/db";
import { GET } from "./route";

const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.clearAllMocks();
  vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/discover", () => {
  it("returns 400 for invalid type", async () => {
    const req = new NextRequest("http://localhost/api/discover?type=anime");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid type");
  });

  it("returns TMDB movie titles", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/discover/movie", () =>
        HttpResponse.json({
          results: [
            { id: 550, title: "Fight Club", overview: "First rule.", poster_path: "/poster.jpg" },
          ],
        })
      )
    );

    const req = new NextRequest("http://localhost/api/discover?type=movie");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.titles).toHaveLength(1);
    expect(data.titles[0].name).toBe("Fight Club");
    expect(data.titles[0].type).toBe("movie");
  });

  it("returns TMDB tv titles", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/discover/tv", () =>
        HttpResponse.json({
          results: [
            { id: 1399, name: "Game of Thrones", overview: "Dragons.", poster_path: null },
          ],
        })
      )
    );

    const req = new NextRequest("http://localhost/api/discover?type=tv&timeframe=all");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.titles[0].name).toBe("Game of Thrones");
    expect(data.titles[0].type).toBe("tv");
  });

  it("returns 502 when TMDB responds with error", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/discover/movie", () =>
        new HttpResponse("Service Unavailable", { status: 503 })
      )
    );

    const req = new NextRequest("http://localhost/api/discover?type=movie");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  it("returns AI picks when source=ai", async () => {
    mockDb.execute.mockResolvedValue({
      rows: [
        { tmdb_id: 550, title: "Fight Club", poster: "/poster.jpg", year: 1999, description: "Fight stuff", rank: 1 },
      ],
    });

    const req = new NextRequest("http://localhost/api/discover?type=movie&source=ai");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.titles).toHaveLength(1);
    expect(data.titles[0].name).toBe("Fight Club");
  });

  it("returns empty titles array when AI source query fails", async () => {
    mockDb.execute.mockRejectedValue(new Error("table does not exist"));

    const req = new NextRequest("http://localhost/api/discover?type=movie&source=ai");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.titles).toEqual([]);
  });

  it("handles empty TMDB results gracefully", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/discover/movie", () =>
        HttpResponse.json({ results: [] })
      )
    );

    const req = new NextRequest("http://localhost/api/discover?type=movie");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.titles).toEqual([]);
  });
  it("returns 400 for source=regional with type=movie", async () => {
    const req = new NextRequest(
      "http://localhost/api/discover?type=movie&source=regional&region=GB"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("scopes source=regional to the region's origin countries and recent air dates", async () => {
    const seen: URL[] = [];
    server.use(
      http.get("https://api.themoviedb.org/3/discover/tv", ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json({
          results: [
            { id: 95480, name: "Slow Horses", first_air_date: "2022-04-01", poster_path: "/sh.jpg" },
            { id: 1440, name: "Coronation Street", first_air_date: "1960-12-09", poster_path: "/cs.jpg" },
          ],
        });
      })
    );

    const req = new NextRequest(
      "http://localhost/api/discover?type=tv&source=regional&region=AU"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const params = seen[0].searchParams;
    expect(params.get("with_origin_country")).toBe("AU|NZ");
    expect(params.get("sort_by")).toBe("popularity.desc");
    expect(params.get("air_date.gte")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // News, reality, talk, soap and kids are all excluded.
    expect(params.get("without_genres")).toBe("10763,10764,10767,10766,10762");

    // Two pages are requested so the evergreen filter has headroom.
    expect(seen.map((u) => u.searchParams.get("page")).sort()).toEqual(["1", "2"]);

    // Coronation Street is filtered out as an evergreen long-runner.
    const data = await res.json();
    expect(data.titles.map((t: { name: string }) => t.name)).toEqual(["Slow Horses"]);
  });

  it("defaults source=regional to GB when no region is supplied", async () => {
    const seen: URL[] = [];
    server.use(
      http.get("https://api.themoviedb.org/3/discover/tv", ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json({ results: [] });
      })
    );

    await GET(new NextRequest("http://localhost/api/discover?type=tv&source=regional"));
    expect(seen[0].searchParams.get("with_origin_country")).toBe("GB|IE");
  });

  it("constrains the recent TV list to a recent air window and drops long-runners", async () => {
    let captured: URL | undefined;
    server.use(
      http.get("https://api.themoviedb.org/3/discover/tv", ({ request }) => {
        captured ??= new URL(request.url);
        return HttpResponse.json({
          results: [
            { id: 1, name: "Reacher", first_air_date: "2022-02-04", poster_path: "/r.jpg" },
            { id: 2, name: "The Simpsons", first_air_date: "1989-12-17", poster_path: "/s.jpg" },
          ],
        });
      })
    );

    const res = await GET(new NextRequest("http://localhost/api/discover?type=tv"));
    const params = captured!.searchParams;
    expect(params.get("air_date.gte")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.get("without_genres")).toContain("10767");
    expect(params.get("vote_count.gte")).toBe("50");

    const data = await res.json();
    expect(data.titles.map((t: { name: string }) => t.name)).toEqual(["Reacher"]);
  });

  it("bounds the recent movie list to released titles only", async () => {
    let captured: URL | undefined;
    server.use(
      http.get("https://api.themoviedb.org/3/discover/movie", ({ request }) => {
        captured ??= new URL(request.url);
        return HttpResponse.json({ results: [] });
      })
    );

    await GET(new NextRequest("http://localhost/api/discover?type=movie"));
    const params = captured!.searchParams;
    expect(params.get("primary_release_date.gte")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Without an upper bound, unreleased films with inflated scores leak in.
    expect(params.get("primary_release_date.lte")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("raises the vote floor for the all-time lists so classics outrank new releases", async () => {
    let tvParams: URLSearchParams | undefined;
    let movieParams: URLSearchParams | undefined;
    server.use(
      http.get("https://api.themoviedb.org/3/discover/tv", ({ request }) => {
        tvParams ??= new URL(request.url).searchParams;
        return HttpResponse.json({ results: [] });
      }),
      http.get("https://api.themoviedb.org/3/discover/movie", ({ request }) => {
        movieParams ??= new URL(request.url).searchParams;
        return HttpResponse.json({ results: [] });
      })
    );

    await GET(new NextRequest("http://localhost/api/discover?type=tv&timeframe=all"));
    await GET(new NextRequest("http://localhost/api/discover?type=movie&timeframe=all"));

    expect(tvParams!.get("sort_by")).toBe("vote_average.desc");
    expect(tvParams!.get("vote_count.gte")).toBe("1500");
    expect(tvParams!.get("first_air_date.lte")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(movieParams!.get("vote_count.gte")).toBe("5000");
    expect(movieParams!.get("primary_release_date.lte")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes year and rating on TMDB results", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/discover/movie", () =>
        HttpResponse.json({
          results: [
            { id: 550, title: "Fight Club", release_date: "1999-10-15", poster_path: "/p.jpg" },
          ],
        })
      )
    );

    const res = await GET(new NextRequest("http://localhost/api/discover?type=movie"));
    const data = await res.json();
    expect(data.titles[0].year).toBe(1999);
    expect(data.titles[0].rating).toBe(0);
  });
});
