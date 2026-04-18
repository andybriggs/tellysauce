import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/db";
import { GET } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockFindFirst = (db as unknown as { query: { users: { findFirst: ReturnType<typeof vi.fn> } } }).query.users.findFirst;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/subscription-status", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns subscription status for authenticated user", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      subscriptionStatus: "active",
      freeRecCallsUsed: 2,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subscriptionStatus).toBe("active");
    expect(data.freeRecCallsUsed).toBe(2);
  });

  it("returns null status and 0 calls when user has no subscription data", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subscriptionStatus).toBeNull();
    expect(data.freeRecCallsUsed).toBe(0);
  });

  it("returns null status when subscriptionStatus is null in DB", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      subscriptionStatus: null,
      freeRecCallsUsed: 1,
    });

    const res = await GET();
    const data = await res.json();
    expect(data.subscriptionStatus).toBeNull();
    expect(data.freeRecCallsUsed).toBe(1);
  });
});
