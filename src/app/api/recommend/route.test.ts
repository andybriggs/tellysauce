import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

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

import { getServerSession } from "next-auth";
import { db } from "@/db";
import { POST } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> };

// Access the shared generateContent mock via module
async function getMockGenerateContent() {
  const mod = await import("@google/genai");
  return (mod as unknown as { __mockGenerateContent: ReturnType<typeof vi.fn> }).__mockGenerateContent;
}

// Helper: set up db.execute so subscription query returns specific user row
// The route calls db.execute for:
//   1. CREATE TABLE recommendation_sets (ensureTablesOnce — runs once at module load)
//   2. CREATE TABLE recommendation_items (ensureTablesOnce)
//   3. CREATE INDEX (ensureTablesOnce)
//   4. SELECT subscription_status, free_rec_calls_used (per request)
//   5+ upsert/insert operations
//
// Since ensureTablesOnce is a module-level IIFE (runs at import), by test time
// it has already resolved. We just need to set up what each per-request call returns.
function setupSubscriptionExec(row: { subscription_status: string | null; free_rec_calls_used: number }) {
  mockDb.execute.mockImplementation((sqlArg: unknown) => {
    const sqlStr = JSON.stringify(sqlArg);
    if (sqlStr.includes("subscription_status") && sqlStr.includes("free_rec_calls_used")) {
      return Promise.resolve({ rows: [row] });
    }
    if (sqlStr.includes("recommendation_sets") && sqlStr.includes("RETURNING")) {
      return Promise.resolve({ rows: [{ id: "set-uuid-1" }] });
    }
    return Promise.resolve(undefined);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: resolve all db.execute calls
  mockDb.execute.mockResolvedValue(undefined);
  vi.stubEnv("GOOGLE_GEMINI_API_KEY", "test-gemini-key");
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

  it("returns 402 when free tier exhausted and no active subscription", async () => {
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

  it("succeeds for active subscriber", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 10 });

    const mockGenerateContent = await getMockGenerateContent();
    mockGenerateContent
      .mockResolvedValueOnce({
        candidates: [{
          content: { parts: [{ text: "The Matrix (1999) | Sci-fi classic | Great choice | sci-fi, action\n" }] },
          finishReason: "STOP",
        }],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify([{
          title: "The Matrix",
          description: "A hacker discovers the truth.",
          reason: "Great choice",
          tags: ["sci-fi", "action"],
          year: 1999,
        }]),
      });

    const req = new NextRequest("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendations).toBeDefined();
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  it("succeeds for user within free tier (freeRecCallsUsed < 3)", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-2" } } as never);
    setupSubscriptionExec({ subscription_status: null, free_rec_calls_used: 0 });

    const mockGenerateContent = await getMockGenerateContent();
    mockGenerateContent
      .mockResolvedValueOnce({
        candidates: [{
          content: { parts: [{ text: "Interstellar (2014) | Space epic | Loved by sci-fi fans | sci-fi, drama\n" }] },
          finishReason: "STOP",
        }],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify([{
          title: "Interstellar",
          description: "Space exploration drama.",
          reason: "Loved by sci-fi fans",
          tags: ["sci-fi", "drama"],
          year: 2014,
        }]),
      });

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
});
