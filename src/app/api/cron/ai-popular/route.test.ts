import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/tmdb", () => ({
  TMDB_BASE: "https://api.themoviedb.org/3",
  searchTmdbByTitle: vi.fn(),
  tmdbImg: {
    posterLarge: vi.fn((p: string | null) =>
      p ? `https://image.tmdb.org/t/p/w500${p}` : null
    ),
  },
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
import { searchTmdbByTitle } from "@/server/tmdb";
import { GET } from "./route";
import { prioritiseNewTitles } from "./helpers";
import type { ResolvedTitle } from "./helpers";

const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> };
const mockSearchTmdbByTitle = vi.mocked(searchTmdbByTitle);

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
    };

    const { mockResponsesCreate } = await getMocks();
    mockResponsesCreate
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle])) // movie
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle])); // tv

    mockSearchTmdbByTitle.mockResolvedValue({
      id: 603,
      title: "The Matrix",
      posterPath: "/poster.jpg",
      overview: "A computer hacker learns about the true nature of reality.",
      year: 1999,
    });

    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.fetchedDate).toBe("string");
    expect(typeof data.movies).toBe("number");
    expect(typeof data.tv).toBe("number");
    expect(mockResponsesCreate).toHaveBeenCalledTimes(2);
  });

  it("passes the AI title and year to searchTmdbByTitle and uses the returned hit", async () => {
    const structuredTitle = {
      title: "Bridgerton",
      description: "Regency-era drama",
      reason: "Hugely popular",
      tags: ["drama", "romance"],
      year: 2020,
    };

    const { mockResponsesCreate } = await getMocks();
    mockResponsesCreate
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle])) // movie
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle])); // tv

    mockSearchTmdbByTitle.mockResolvedValue({
      id: 46952,
      title: "Bridgerton",
      posterPath: "/bridgerton.jpg",
      overview: "Regency-era drama.",
      year: 2020,
    });

    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);
    expect(res.status).toBe(200);

    // searchTmdbByTitle should be called with the AI-returned title and year.
    expect(mockSearchTmdbByTitle).toHaveBeenCalledWith("Bridgerton", expect.any(String), 2020);
    const data = await res.json();
    expect(data.movies).toBe(1);
    expect(data.tv).toBe(1);
  });

  it("skips titles when searchTmdbByTitle returns null (no popular match)", async () => {
    const structuredTitle = {
      title: "Some Obscure Doc",
      description: "Clickbait documentary",
      reason: "Web search hallucination",
      tags: ["documentary"],
      year: 2023,
    };

    const { mockResponsesCreate } = await getMocks();
    mockResponsesCreate
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle]))
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle]));

    mockSearchTmdbByTitle.mockResolvedValue(null);

    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.movies).toBe(0);
    expect(data.tv).toBe(0);
  });

  it("skips titles that resolve to a TMDB hit with no poster", async () => {
    const structuredTitle = {
      title: "No Poster Show",
      description: "A show",
      reason: "Popular",
      tags: ["drama"],
      year: 2024,
    };

    const { mockResponsesCreate } = await getMocks();
    mockResponsesCreate
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle]))
      .mockResolvedValueOnce(makeStructuredResponse([structuredTitle]));

    // searchTmdbByTitle resolves but has no poster_path.
    mockSearchTmdbByTitle.mockResolvedValue({
      id: 7777,
      title: "No Poster Show",
      posterPath: null,
      overview: "A show with no poster art.",
      year: 2024,
    });

    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.movies).toBe(0);
    expect(data.tv).toBe(0);
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

/** ------------------------------------------------------------------ */
/** prioritiseNewTitles — pure ordering logic                          */
/** ------------------------------------------------------------------ */

function makeTitle(tmdbId: number, title = `Title ${tmdbId}`): ResolvedTitle {
  return {
    tmdbId,
    title,
    poster: null,
    year: 2024,
    description: null,
    reason: "Popular",
    redditQuotes: [],
  };
}

describe("prioritiseNewTitles", () => {
  it("returns all titles unchanged when the previous batch is empty", () => {
    const titles = [makeTitle(1), makeTitle(2), makeTitle(3)];
    const result = prioritiseNewTitles(titles, new Set());
    expect(result.map((t) => t.tmdbId)).toEqual([1, 2, 3]);
  });

  it("ranks new titles before returning titles", () => {
    // AI order: 100 (returning), 300 (new), 200 (returning)
    const titles = [makeTitle(100), makeTitle(300), makeTitle(200)];
    const prev = new Set([100, 200]);
    const result = prioritiseNewTitles(titles, prev);
    expect(result.map((t) => t.tmdbId)).toEqual([300, 100, 200]);
  });

  it("preserves AI order within each group", () => {
    // AI order: 10 (new), 50 (returning), 20 (new), 30 (new)
    const titles = [makeTitle(10), makeTitle(50), makeTitle(20), makeTitle(30)];
    const prev = new Set([50]);
    const result = prioritiseNewTitles(titles, prev);
    expect(result.map((t) => t.tmdbId)).toEqual([10, 20, 30, 50]);
  });

  it("preserves original order when all titles are returning", () => {
    const titles = [makeTitle(1), makeTitle(2), makeTitle(3)];
    const prev = new Set([1, 2, 3]);
    const result = prioritiseNewTitles(titles, prev);
    expect(result.map((t) => t.tmdbId)).toEqual([1, 2, 3]);
  });

  it("preserves original order when all titles are new", () => {
    const titles = [makeTitle(7), makeTitle(8), makeTitle(9)];
    const prev = new Set([1, 2, 3]); // none overlap
    const result = prioritiseNewTitles(titles, prev);
    expect(result.map((t) => t.tmdbId)).toEqual([7, 8, 9]);
  });
});

