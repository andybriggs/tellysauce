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
});
