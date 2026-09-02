import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/server/badges", () => ({
  awardAllBadges: vi.fn(),
  getBadgeProgress: vi.fn(),
  getUserBadges: vi.fn(),
  markBadgesSeen: vi.fn(),
}));

import { getServerSession } from "next-auth";
import {
  awardAllBadges,
  getBadgeProgress,
  getUserBadges,
  markBadgesSeen,
} from "@/server/badges";
import { GET, POST } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockGetUserBadges = vi.mocked(getUserBadges);
const mockMarkSeen = vi.mocked(markBadgesSeen);
const mockAwardAll = vi.mocked(awardAllBadges);
const mockProgress = vi.mocked(getBadgeProgress);

const postReq = (body: unknown) =>
  new Request("http://localhost/api/badges", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockAwardAll.mockResolvedValue([]);
  mockGetUserBadges.mockResolvedValue([]);
  mockProgress.mockResolvedValue({ watchlist: 0, rated: 0, recs: 0 });
});

describe("GET /api/badges", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the user's badges", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const badges = [
      { key: "rated_5", awardedAt: "2026-01-15T10:00:00.000Z", seen: false },
    ];
    mockGetUserBadges.mockResolvedValue(badges);

    mockProgress.mockResolvedValue({ watchlist: 3, rated: 8, recs: 1 });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      badges,
      progress: { watchlist: 3, rated: 8, recs: 1 },
    });
    expect(mockGetUserBadges).toHaveBeenCalledWith("user-1");
  });

  it("catches up any newly qualifying badges before reporting", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);

    await GET();

    expect(mockAwardAll).toHaveBeenCalledWith("user-1");
  });

  it("does not evaluate badges when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    await GET();

    expect(mockAwardAll).not.toHaveBeenCalled();
  });
});

describe("POST /api/badges", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(postReq({ keys: ["rated_5"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when keys is not an array", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const res = await POST(postReq({ keys: "rated_5" }));
    expect(res.status).toBe(400);
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it("marks the given keys seen", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockMarkSeen.mockResolvedValue(undefined);

    const res = await POST(postReq({ keys: ["rated_5", "rated_15"] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockMarkSeen).toHaveBeenCalledWith("user-1", ["rated_5", "rated_15"]);
  });

  it("filters out non-string keys", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockMarkSeen.mockResolvedValue(undefined);

    await POST(postReq({ keys: ["rated_5", 42, null] }));

    expect(mockMarkSeen).toHaveBeenCalledWith("user-1", ["rated_5"]);
  });
});
