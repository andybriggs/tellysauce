import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// The recommendations route uses db.execute (for table creation) and db.select (Drizzle fluent chain)
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(),
  },
}));

// Mock drizzle-orm sql/eq so the route can import them without errors
vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return { ...original };
});

import { getServerSession } from "next-auth";
import { db } from "@/db";
import { GET } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockDb = db as unknown as {
  execute: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

function mockSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  chain.orderBy.mockResolvedValue(rows);
  mockDb.select.mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Always resolve execute (table creation SQL) successfully
  mockDb.execute.mockResolvedValue(undefined);
});

describe("GET /api/recommendations", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/recommendations?key=profile");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when key param missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);

    const req = new NextRequest("http://localhost/api/recommendations");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing key");
  });

  it("returns empty items when set not found", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    // The route does: db.select().from(recommendationSets).where(...).limit(1)
    mockSelectChain([]);

    const req = new NextRequest("http://localhost/api/recommendations?key=profile");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.set).toBeNull();
    expect(data.items).toEqual([]);
  });

  it("returns set and items when found", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);

    const fakeSet = {
      id: "set-uuid-1",
      userId: "user-1",
      key: "profile",
      userKey: "user-1:profile",
    };

    const fakeItems = [
      {
        id: "item-1",
        setId: "set-uuid-1",
        rank: 0,
        title: "The Matrix",
        description: "A hacker discovers reality.",
        reason: "Similar vibe",
        tags: ["sci-fi", "action"],
        suggestedMediaType: "movie",
        suggestedTmdbId: 603,
        suggestedImdbId: null,
        poster: "https://image.tmdb.org/t/p/w342/matrix.jpg",
        rawJson: { title: "The Matrix", year: 1999 },
        createdAt: new Date(),
        updatedAt: new Date(),
        year: 1999,
      },
    ];

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      const chain = {
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        orderBy: vi.fn(),
        leftJoin: vi.fn(),
      };
      chain.from.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      chain.leftJoin.mockReturnValue(chain);
      if (callCount === 1) {
        // First call: look up the recommendation set
        chain.limit.mockResolvedValue([fakeSet]);
      } else {
        // Second call: look up items (with leftJoin for titles poster)
        chain.orderBy.mockResolvedValue(fakeItems);
      }
      return chain;
    });

    const req = new NextRequest("http://localhost/api/recommendations?key=profile");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.set).toBeTruthy();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe("The Matrix");
    expect(data.items[0].poster).toBe("https://image.tmdb.org/t/p/w342/matrix.jpg");
  });
});
