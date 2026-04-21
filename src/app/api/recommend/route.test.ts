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

// Helper: set up db.execute so subscription query returns specific user row
function setupSubscriptionExec(row: {
  subscription_status: string | null;
  free_rec_calls_used: number;
}) {
  mockDb.execute.mockImplementation((sqlArg: unknown) => {
    const sqlStr = JSON.stringify(sqlArg);
    if (
      sqlStr.includes("subscription_status") &&
      sqlStr.includes("free_rec_calls_used")
    ) {
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
  mockDb.execute.mockResolvedValue(undefined);
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
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
    setupSubscriptionExec({
      subscription_status: "active",
      free_rec_calls_used: 10,
    });

    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(
      makeOpenAIResponse([
        {
          title: "The Matrix",
          description: "A hacker discovers the truth.",
          reason: "Great choice",
          tags: ["sci-fi", "action"],
          year: 1999,
        },
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
    expect(data.recommendations).toBeDefined();
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  it("succeeds for user within free tier (freeRecCallsUsed < 3)", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-2" } } as never);
    setupSubscriptionExec({
      subscription_status: null,
      free_rec_calls_used: 0,
    });

    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(
      makeOpenAIResponse([
        {
          title: "Interstellar",
          description: "Space exploration drama.",
          reason: "Loved by sci-fi fans",
          tags: ["sci-fi", "drama"],
          year: 2014,
        },
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
    expect(data.recommendations).toBeDefined();
  });

  it("returns 400 when no titles provided in profile mode", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    setupSubscriptionExec({
      subscription_status: "active",
      free_rec_calls_used: 0,
    });

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
    setupSubscriptionExec({
      subscription_status: "active",
      free_rec_calls_used: 0,
    });

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
