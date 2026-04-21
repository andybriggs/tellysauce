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

// Mock @/lib/ai — openai has both chat.completions.create (structuring/quotes)
// and responses.create (web search grounding), each with their own mock fn.
vi.mock("@/lib/ai", () => {
  const mockCreate = vi.fn();
  const mockResponsesCreate = vi.fn();
  return {
    openai: {
      chat: { completions: { create: mockCreate } },
      responses: { create: mockResponsesCreate },
    },
    __mockCreate: mockCreate,
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
    __mockCreate: ReturnType<typeof vi.fn>;
    __mockResponsesCreate: ReturnType<typeof vi.fn>;
  };
  return { mockCreate: m.__mockCreate, mockResponsesCreate: m.__mockResponsesCreate };
}

function makeResponsesResponse(text: string) {
  return { output_text: text };
}

function makeJsonResponse(data: unknown) {
  return { choices: [{ message: { content: JSON.stringify(data) } }] };
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
    const groundedText =
      "The Matrix (1999) | A sci-fi classic | Hugely popular | sci-fi, action";
    const structuredRecs = {
      titles: [
        {
          title: "The Matrix",
          description: "A sci-fi classic",
          reason: "Hugely popular",
          tags: ["sci-fi", "action"],
          year: 1999,
        },
      ],
    };
    const quotes = {
      items: [
        {
          quotes: [
            { text: "A masterpiece of sci-fi cinema", subreddit: "movies" },
          ],
        },
      ],
    };

    const { mockCreate, mockResponsesCreate } = await getMocks();

    // Stage 1: web search via responses.create (movie + tv in parallel)
    mockResponsesCreate
      .mockResolvedValueOnce(makeResponsesResponse(groundedText))
      .mockResolvedValueOnce(makeResponsesResponse(groundedText));

    // Stage 2 + 3.5: structuring and quotes via chat.completions.create
    mockCreate
      .mockResolvedValueOnce(makeJsonResponse(structuredRecs)) // movie struct
      .mockResolvedValueOnce(makeJsonResponse(structuredRecs)) // tv struct
      .mockResolvedValueOnce(makeJsonResponse(quotes))         // movie quotes
      .mockResolvedValueOnce(makeJsonResponse(quotes));        // tv quotes

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
