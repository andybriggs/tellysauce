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

// GoogleGenAI mock — must be a class constructor
vi.mock("@google/genai", () => {
  const mockGenerateContent = vi.fn();
  class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent };
    constructor() {}
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      ARRAY: "array",
      OBJECT: "object",
      STRING: "string",
      INTEGER: "integer",
    },
    __mockGenerateContent: mockGenerateContent,
  };
});

import { db } from "@/db";
import { fetchTMDBTitle } from "@/server/tmdb";
import { GET } from "./route";

const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> };
const mockFetchTMDBTitle = vi.mocked(fetchTMDBTitle);

async function getMockGenerateContent() {
  const mod = await import("@google/genai");
  return (mod as unknown as { __mockGenerateContent: ReturnType<typeof vi.fn> }).__mockGenerateContent;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  vi.stubEnv("GOOGLE_GEMINI_API_KEY", "test-gemini-key");
  vi.stubEnv("GEMINI_MODEL_GROUNDED_HQ", "gemini-2.5-pro");
  vi.stubEnv("GEMINI_MODEL_STRUCT", "gemini-2.5-flash-lite");
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

  it("returns 500 when GOOGLE_GEMINI_API_KEY is missing", async () => {
    vi.stubEnv("GOOGLE_GEMINI_API_KEY", "");
    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/GOOGLE_GEMINI_API_KEY/);
  });

  it("executes successfully with valid auth and mocked Gemini + TMDB", async () => {
    const groundedText = "The Matrix (1999) | A sci-fi classic | Hugely popular | sci-fi, action";
    const jsonRecs = JSON.stringify([{
      title: "The Matrix",
      description: "A sci-fi classic",
      reason: "Hugely popular",
      tags: ["sci-fi", "action"],
      year: 1999,
    }]);

    const mockGenerateContent = await getMockGenerateContent();
    // 4 calls in parallel pairs: movie grounded, tv grounded, movie struct, tv struct
    mockGenerateContent
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: groundedText }] }, finishReason: "STOP" }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: groundedText }] }, finishReason: "STOP" }] })
      .mockResolvedValueOnce({ text: jsonRecs })
      .mockResolvedValueOnce({ text: jsonRecs });

    // TMDB search returns an ID (used by searchTmdbId)
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({ results: [{ id: 603 }] })
      ),
      http.get("https://api.themoviedb.org/3/search/tv", () =>
        HttpResponse.json({ results: [{ id: 1399 }] })
      )
    );

    // fetchTMDBTitle returns enriched data
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

  it("returns 500 when Gemini throws", async () => {
    const mockGenerateContent = await getMockGenerateContent();
    mockGenerateContent.mockRejectedValue(new Error("Gemini API failed"));

    const req = makeRequest("Bearer test-cron-secret");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Cron job failed");
  });
});
