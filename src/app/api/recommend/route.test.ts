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
  slugTitle: vi.fn((s: string) => s.toLowerCase().trim()),
}));

vi.mock("@/server/titleStore", () => ({
  getRated: vi.fn().mockResolvedValue([]),
  getWatchlist: vi.fn().mockResolvedValue([]),
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
import { getRated, getWatchlist } from "@/server/titleStore";
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
  vi.mocked(getRated).mockResolvedValue([]);
  vi.mocked(getWatchlist).mockResolvedValue([]);
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

  it("sends only params gpt-6-luna accepts", async () => {
    // Regression guard: gpt-6-luna rejects `max_tokens` (wants
    // `max_completion_tokens`) and any explicit `temperature`. Passing either
    // returns a 400 from OpenAI, which surfaced as a 500 on /api/recommend.
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
    await POST(req);

    const params = mockCreate.mock.calls[0][0];
    expect(params.model).toBe("gpt-6-luna");
    expect(params).not.toHaveProperty("max_tokens");
    expect(params).not.toHaveProperty("temperature");
    expect(params.max_completion_tokens).toBeGreaterThanOrEqual(2000);
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

  describe("already-seen exclusion", () => {
    function profileRequest(titles: unknown[]) {
      return new NextRequest("http://localhost/api/recommend", {
        method: "POST",
        body: JSON.stringify({ titles }),
        headers: { "Content-Type": "application/json" },
      });
    }

    it("drops a rec whose TMDB id the user has already rated, even when the title differs", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
      stubTmdbSuccess(); // every search resolves to movie 603
      vi.mocked(getRated).mockResolvedValue([
        { id: 603, type: "movie", name: "Matrix, The" },
      ] as never);

      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse([makeRec({ title: "The Matrix (1999)" })])
      );

      const res = await POST(profileRequest([{ title: "Inception", rating: 5 }]));
      expect(res.status).toBe(200);
      expect((await res.json()).recommendations).toHaveLength(0);
    });

    it("lists every rated and watchlisted title in the prompt, not just those sent as signal", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
      stubTmdbSuccess();
      vi.mocked(getRated).mockResolvedValue([
        { id: 1, type: "tv", name: "Old Rated Show" },
      ] as never);
      vi.mocked(getWatchlist).mockResolvedValue([
        { id: 2, type: "movie", name: "Saved Film" },
      ] as never);

      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(makeOpenAIResponse([makeRec()]));

      await POST(profileRequest([{ title: "Inception", rating: 5 }]));
      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).toContain("- Old Rated Show");
      expect(prompt).toContain("- Saved Film");
    });

    it("excludes rated titles in seed mode too", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
      stubTmdbSuccess();
      vi.mocked(getRated).mockResolvedValue([
        { id: 603, type: "movie", name: "The Matrix" },
      ] as never);

      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(makeOpenAIResponse([makeRec({ title: "Matrix" })]));

      const res = await POST(
        new NextRequest("http://localhost/api/recommend", {
          method: "POST",
          body: JSON.stringify({ mode: "seed", seed: { title: "Inception", type: "movie" } }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).toContain("- The Matrix");
      expect((await res.json()).recommendations).toHaveLength(0);
    });

    it("still succeeds when the exclusion lookup fails", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
      stubTmdbSuccess();
      vi.mocked(getRated).mockRejectedValue(new Error("db down"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(makeOpenAIResponse([makeRec()]));

      const res = await POST(profileRequest([{ title: "Inception", rating: 5 }]));
      expect(res.status).toBe(200);
      expect((await res.json()).recommendations).toHaveLength(1);
    });
  });

  describe("profile taste signal", () => {
    it("sends every 4-5 star title, strongest first, with 1-2 stars as dislikes", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
      stubTmdbSuccess();

      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(makeOpenAIResponse([makeRec()]));

      // 20 recent 3-star ratings ahead of the favourites - the old slice(0, 12)
      // would have sent none of the 5-star titles.
      const titles = [
        ...Array.from({ length: 20 }, (_, i) => ({ title: `Meh ${i}`, type: "tv", rating: 3 })),
        { title: "Four Star", type: "tv", rating: 4 },
        { title: "Five Star", type: "tv", rating: 5 },
        { title: "Hated It", type: "movie", rating: 1 },
      ];
      await POST(
        new NextRequest("http://localhost/api/recommend", {
          method: "POST",
          body: JSON.stringify({ titles }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      const loved = prompt.slice(prompt.indexOf("LOVED"), prompt.indexOf("OK ("));
      expect(loved.indexOf("Five Star")).toBeLessThan(loved.indexOf("Four Star"));
      expect(loved.indexOf("Four Star")).toBeGreaterThan(-1);
      expect(prompt).toMatch(/DISLIKED[^]*- Hated It/);
      expect(prompt).toContain("Return EXACTLY 12 titles"); // 8 + 4 spare
    });

    it("trims the over-request back to the target count", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
      stubTmdbSuccess();

      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(
        makeOpenAIResponse(Array.from({ length: 12 }, (_, i) => makeRec({ title: `Rec ${i}` })))
      );

      const res = await POST(
        new NextRequest("http://localhost/api/recommend", {
          method: "POST",
          body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
          headers: { "Content-Type": "application/json" },
        })
      );
      expect((await res.json()).recommendations).toHaveLength(8);
    });
  });

  describe("truncated OpenAI output", () => {
    const req = () =>
      new NextRequest("http://localhost/api/recommend", {
        method: "POST",
        body: JSON.stringify({ titles: [{ title: "Inception", rating: 5 }] }),
        headers: { "Content-Type": "application/json" },
      });
    // What gpt-6-luna returns when reasoning eats the whole token budget.
    const truncated = { choices: [{ finish_reason: "length", message: { content: "" } }] };

    it("retries once when the model runs out of tokens before answering", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });
      stubTmdbSuccess();

      const mockCreate = await getMockCreate();
      mockCreate
        .mockResolvedValueOnce(truncated)
        .mockResolvedValueOnce(makeOpenAIResponse([makeRec()]));

      const res = await POST(req());
      expect(res.status).toBe(200);
      expect((await res.json()).recommendations).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("fails cleanly, without charging the user, when both attempts are truncated", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      setupSubscriptionExec({ subscription_status: "active", free_rec_calls_used: 0 });

      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValue(truncated);

      const res = await POST(req());
      expect(res.status).toBe(500);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      const charged = mockDb.execute.mock.calls.some((c) =>
        JSON.stringify(c[0]).includes("lifetime_rec_calls")
      );
      expect(charged).toBe(false);
    });
  });
});
