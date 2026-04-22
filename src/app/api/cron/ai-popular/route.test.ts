import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";

// ---- Mocks ----
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/tmdb", () => ({
  TMDB_BASE: "https://api.themoviedb.org/3",
  fetchTMDBTitle: vi.fn(),
}));

// Mock @/lib/ai — only responses.create is used (web search + structured output in one call)
vi.mock("@/lib/ai", () => {
  const mockResponsesCreate = vi.fn();
  return {
    openai: {
      chat: { completions: { create: vi.fn() } },
      responses: { create: mockResponsesCreate },
    },
    __mockResponsesCreate: mockResponsesCreate,
  };
});

import { db } from "@/db";
import { fetchTMDBTitle } from "@/server/tmdb";
import { GET } from "./route";

const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> };
const mockFetchTMDBTitle = vi.mocked(fetchTMDBTitle);

async function getMocks() {
  const mod = await import("@/lib/ai");
  const m = mod as unknown as {
    __mockResponsesCreate: ReturnType<typeof vi.fn>;
  };
  return { mockResponsesCreate: m.__mockResponsesCreate };
}

function makeStructuredResponse(titles: unknown[]) {
  return { output_text: JSON.stringify({ titles }) };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  mockDb.execute.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function makeRequest(authHeader?: string) {
  return new NextRequest("http://localhost/api/cron/ai-popular", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/ai-popular", () => {
  it("returns 401 without CRON_SECRET", async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const req = makeRequest("Bearer wrong-secret");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/OPENAI_API_KEY/);
  });

  it("executes successfully with valid auth and mocked OpenAI + TMDB", async () => {
    const structuredTitle = {
      title: "The Matrix",
      description: "A sci-fi classic",
      reason: "Hugely popular",
      tags: ["sci-fi", "action"],
      year: 1999,
      reddit_quote: "A masterpiece of sci-fi cinema that still holds up.",
      reddit_url: "https://reddit.com/r/movies/comments/abc123/the_matrix/",
      subreddit: "movies",
    };

    const { mockResponsesCreate } = await getMocks();

    // Stage 1: single structured web search call per media type
    mockResponsesCreate
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle])) // movie
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle])); // tv

    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({ results: [{ id: 603 }] })
      ),
      http.get("https://api.themoviedb.org/3/search/tv", () =>
        HttpResponse.json({ results: [{ id: 1399 }] })
      )
    );

    mockFetchTMDBTitle.mockResolvedValue({
      tmdbId: 603,
      mediaType: "movie",
      title: "The Matrix",
      poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
      year: 1999,
      description: "A computer hacker learns about the true nature of reality.",
    } as never);

    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.fetchedDate).toBe("string");
    expect(typeof data.movies).toBe("number");
    expect(typeof data.tv).toBe("number");
    // Only responses.create should have been called (no chat completions)
    expect(mockResponsesCreate).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when OpenAI web search throws", async () => {
    const { mockResponsesCreate } = await getMocks();
    mockResponsesCreate.mockRejectedValue(new Error("OpenAI API failed"));

    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Cron job failed");
  });
});
