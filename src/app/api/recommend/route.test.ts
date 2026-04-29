import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/recs", () => ({
  buildRecKey: vi.fn().mockReturnValue("profile-key"),
}));

// OpenAI mock via @/lib/ai
vi.mock("@/lib/ai", () => {
  const mockCreate = vi.fn();
  return {
    openai: { chat: { completions: { create: mockCreate } } },
    __mockCreate: mockCreate,
  };
});

import { getServerSession } from "next-auth";
import { db } from "@/db";
import { POST } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> };

async function getMockCreate() {
  const mod = await import("@/lib/ai");
  return (mod as unknown as { __mockCreate: ReturnType<typeof vi.fn> })
    .__mockCreate;
}

/** Build a realistic OpenAI response with required mediaType field. */
function makeOpenAIResponse(recommendations: unknown[]) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ recommendations }),
        },
      },
    ],
  };
}

/** A valid rec item matching the current schema (mediaType required). */
function makeRec(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: "The Matrix",
    description: "A hacker discovers the truth.",
    reason: "Great sci-fi",
    tags: ["sci-fi", "action"],
    year: 1999,
    mediaType: "movie",
    ...overrides,
  };
}

/** Override MSW to return a valid TMDB search result so validateAndEnrich passes. */
function stubTmdbSuccess() {
  server.use(
    http.get("https://api.themoviedb.org/3/search/:type", () =>
      HttpResponse.json({
        results: [
          {
            id: 603,
            title: "The Matrix",
            name: "The Matrix",
            poster_path: "/matrix.jpg",
            release_date: "1999-03-31",
            overview: "A hacker discovers the truth.",
            popularity: 200,
          },
        ],
      })
    )
  );
}

// Helper: set up db.execute so subscription query returns specific user row
function setupSubscriptionExec(row: {
  subscription_status: string | null;
  free_rec_calls_used: number;
  pro_rec_calls_this_period?: number;
}) {
  mockDb.execute.mockImplementation((sqlArg: unknown) => {
    const sqlStr = JSON.stringify(sqlArg);
    if (
      sqlStr.includes("subscription_status") &&
      sqlStr.includes("free_rec_calls_used")
    ) {
      return Promise.resolve({ rows: [{ pro_rec_calls_this_period: 0, ...row }] });
    }
    if (sqlStr.includes("recommendation_sets") && sqlStr.includes("RETURNING")) {
      return Promise.resolve({ rows: [{ id: "set-uuid-1" }] });
    }
    return Promise.resolve(undefined);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.execute.mockResolvedValue(undefined);
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("TMDB_ACCESS_TOKEN", "test-tmdb-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/recommend", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 402 subscription_required when free tier exhausted and no active subscription", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: null, free_rec_calls_used: 3 });

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toBe("subscription_required");
  });

  it("returns 402 monthly_limit_reached when Pro subscriber hits 100 calls this period", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0, pro_rec_calls_this_period: 100 });

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toBe("monthly_limit_reached");
  });

  it("succeeds for active subscriber and returns TMDB-verified recommendations", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 10 });
    stubTmdbSuccess();

    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeOpenAIResponse([makeRec()]));

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.recommendations)).toBe(true);
    expect(data.recommendations).toHaveLength(1);
    // Verified recs include resolvedTmdbId and poster from TMDB
    expect(data.recommendations[0].resolvedTmdbId).toBe(603);
    expect(data.recommendations[0].mediaType).toBe("movie");
    expect(data.recommendations[0].poster).toContain("image.tmdb.org");
  });

  it("filters out recommendations that cannot be resolved in TMDB", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
    // MSW default returns { results: [] } - all recs will be filtered out

    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(
      makeOpenAIResponse([makeRec({ title: "NonExistentFakeTitle123" })])
    );

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendations).toHaveLength(0);
  });

  it("filters out recs missing mediaType from OpenAI response", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });

    const mockCreate = await getMockCreate();
    // Omit mediaType - should be rejected by the schema filter in callOpenAI
    mockCreate.mockResolvedValueOnce(
      makeOpenAIResponse([
        { title: "The Matrix", description: "A hacker.", reason: "Good", tags: ["sci-fi"], year: 1999 },
      ])
    );

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendations).toHaveLength(0);
  });

  it("succeeds for user within free tier", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-2" } } as never);
    setupSubscriptionExec({ subscription_status: null, free_rec_calls_used: 0 });
    stubTmdbSuccess();

    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeOpenAIResponse([makeRec()]));

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendations).toBeDefined();
  });

  it("returns 400 when no titles provided in profile mode", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("No titles provided");
  });

  it("returns 400 when seed mode has no seed title", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ mode: "seed", seed: {} }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Seed title missing");
  });

  it("seed mode returns verified recommendations with TMDB data", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
    stubTmdbSuccess();

    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeOpenAIResponse([makeRec()]));

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({
        mode: "seed",
        seed: {
          title: "Inception",
          type: "movie",
          year: 2010,
          genres: ["Action", "Sci-Fi"],
          overview: "A thief who steals corporate secrets.",
          external: { tmdbId: 27205 },
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.recommendations)).toBe(true);
    expect(data.recommendations[0].resolvedTmdbId).toBeDefined();
  });
});
