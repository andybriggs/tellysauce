import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";

vi.mock("@/db", () => ({ db: { execute: vi.fn() } }));

import { db } from "@/db";
import { fetchIMDbRating } from "./omdb";

const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> };

const OMDB = "https://www.omdbapi.com/";

function omdbOk(imdbRating: string, rt?: string) {
  return HttpResponse.json({
    Response: "True",
    imdbRating,
    Ratings: rt ? [{ Source: "Rotten Tomatoes", Value: rt }] : [],
  });
}

/** No cached row. */
function cacheMiss() {
  mockDb.execute.mockResolvedValue({ rows: [] });
}

/** A stored row of the given age in hours. */
function cacheHit(age: number, imdb: string | null, rt: string | null = null) {
  mockDb.execute.mockResolvedValue({
    rows: [
      {
        imdb_rating: imdb,
        rt_rating: rt,
        fetched_at: new Date(Date.now() - age * 3600_000).toISOString(),
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("OMDB_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchIMDbRating", () => {
  it("calls OMDb and stores the result when nothing is cached", async () => {
    cacheMiss();
    server.use(http.get(OMDB, () => omdbOk("8.4", "96%")));

    const res = await fetchIMDbRating("tt5875444", 3600);
    expect(res).toEqual({ imdbRating: "8.4", rtRating: "96%" });

    // One read, one write.
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  it("serves a fresh cached rating without calling OMDb", async () => {
    cacheHit(2, "8.4", "96%");
    let called = false;
    server.use(
      http.get(OMDB, () => {
        called = true;
        return omdbOk("9.9");
      })
    );

    const res = await fetchIMDbRating("tt5875444", 3600);
    expect(res).toEqual({ imdbRating: "8.4", rtRating: "96%" });
    expect(called).toBe(false);
  });

  it("refreshes a cached rating once it is older than a day", async () => {
    cacheHit(30, "8.0");
    server.use(http.get(OMDB, () => omdbOk("8.4")));

    const res = await fetchIMDbRating("tt5875444", 3600);
    expect(res.imdbRating).toBe("8.4");
  });

  it("falls back to a stale rating when OMDb refuses, rather than showing nothing", async () => {
    // The quota case: "Request limit reached!" comes back as a 401.
    cacheHit(30, "8.4", "96%");
    server.use(http.get(OMDB, () => new HttpResponse("limit", { status: 401 })));

    const res = await fetchIMDbRating("tt5875444", 3600);
    expect(res).toEqual({ imdbRating: "8.4", rtRating: "96%" });
  });

  it("falls back to a stale rating when OMDb returns Response False", async () => {
    cacheHit(30, "7.4");
    server.use(
      http.get(OMDB, () =>
        HttpResponse.json({ Response: "False", Error: "Request limit reached!" })
      )
    );

    const res = await fetchIMDbRating("tt1234567", 3600);
    expect(res.imdbRating).toBe("7.4");
  });

  it("returns empty ratings when OMDb fails and nothing was ever cached", async () => {
    cacheMiss();
    server.use(http.get(OMDB, () => new HttpResponse("limit", { status: 401 })));

    const res = await fetchIMDbRating("tt1234567", 3600);
    expect(res).toEqual({ imdbRating: null, rtRating: null });
  });

  it("treats an N/A rating as absent", async () => {
    cacheMiss();
    server.use(http.get(OMDB, () => omdbOk("N/A")));

    const res = await fetchIMDbRating("tt1234567", 3600);
    expect(res.imdbRating).toBeNull();
  });

  it("survives the cache table not existing yet", async () => {
    mockDb.execute.mockRejectedValue(new Error("relation does not exist"));
    server.use(http.get(OMDB, () => omdbOk("8.4")));

    const res = await fetchIMDbRating("tt5875444", 3600);
    expect(res.imdbRating).toBe("8.4");
  });

  it("does not call OMDb without an API key", async () => {
    vi.stubEnv("OMDB_API_KEY", "");
    cacheMiss();
    let called = false;
    server.use(
      http.get(OMDB, () => {
        called = true;
        return omdbOk("8.4");
      })
    );

    const res = await fetchIMDbRating("tt5875444", 3600);
    expect(called).toBe(false);
    expect(res).toEqual({ imdbRating: null, rtRating: null });
  });
});
