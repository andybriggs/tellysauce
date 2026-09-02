import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({ db: { execute: vi.fn() } }));

import { db } from "@/db";
import {
  awardAllBadges,
  awardBadges,
  getUserBadges,
  markBadgesSeen,
} from "./badges";

const mockExecute = vi.mocked(db.execute);

/** db.execute returns { rows: [...] } shaped results */
const rows = <T,>(r: T[]) => ({ rows: r }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("awardBadges", () => {
  it("awards nothing below the lowest threshold", async () => {
    mockExecute.mockResolvedValueOnce(rows([{ n: 4 }]));

    const result = await awardBadges("user-1", "watchlist");

    expect(result).toEqual([]);
    // count query only - no insert attempted
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("awards the tier just crossed", async () => {
    mockExecute
      .mockResolvedValueOnce(rows([{ n: 5 }]))
      .mockResolvedValueOnce(rows([{ badge_key: "watchlist_5" }]));

    const result = await awardBadges("user-1", "watchlist");

    expect(result).toEqual(["watchlist_5"]);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("returns only newly inserted keys, not ones already held", async () => {
    // Count of 30 meets tiers 1-3, but the DB reports only tier 3 as new.
    mockExecute
      .mockResolvedValueOnce(rows([{ n: 30 }]))
      .mockResolvedValueOnce(rows([{ badge_key: "watchlist_30" }]));

    const result = await awardBadges("user-1", "watchlist");

    expect(result).toEqual(["watchlist_30"]);
  });

  it("backfills every met tier for an established user", async () => {
    mockExecute
      .mockResolvedValueOnce(rows([{ n: 60 }]))
      .mockResolvedValueOnce(
        rows([
          { badge_key: "rated_5" },
          { badge_key: "rated_15" },
          { badge_key: "rated_30" },
          { badge_key: "rated_50" },
        ])
      );

    const result = await awardBadges("user-1", "rated");

    expect(result).toEqual(["rated_5", "rated_15", "rated_30", "rated_50"]);
  });

  it("counts recs from users.lifetime_rec_calls", async () => {
    mockExecute
      .mockResolvedValueOnce(rows([{ lifetime_rec_calls: 1 }]))
      .mockResolvedValueOnce(rows([{ badge_key: "recs_1" }]));

    const result = await awardBadges("user-1", "recs");

    expect(result).toEqual(["recs_1"]);
  });

  it("returns [] instead of throwing when the DB fails", async () => {
    mockExecute.mockRejectedValueOnce(new Error("connection lost"));

    await expect(awardBadges("user-1", "rated")).resolves.toEqual([]);
  });
});

describe("getUserBadges", () => {
  it("maps rows to the client shape", async () => {
    const awarded = new Date("2026-01-15T10:00:00.000Z");
    mockExecute.mockResolvedValueOnce(
      rows([{ badge_key: "rated_5", seen: true, awarded_at: awarded }])
    );

    const result = await getUserBadges("user-1");

    expect(result).toEqual([
      { key: "rated_5", seen: true, awardedAt: "2026-01-15T10:00:00.000Z" },
    ]);
  });

  it("returns [] when the DB fails", async () => {
    mockExecute.mockRejectedValueOnce(new Error("boom"));
    await expect(getUserBadges("user-1")).resolves.toEqual([]);
  });
});

describe("markBadgesSeen", () => {
  it("does not hit the DB for an empty list", async () => {
    await markBadgesSeen("user-1", []);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("issues an update for the given keys", async () => {
    mockExecute.mockResolvedValueOnce(rows([]));
    await markBadgesSeen("user-1", ["rated_5", "rated_15"]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("swallows DB errors", async () => {
    mockExecute.mockRejectedValueOnce(new Error("boom"));
    await expect(markBadgesSeen("user-1", ["rated_5"])).resolves.toBeUndefined();
  });
});

describe("awardAllBadges", () => {
  it("evaluates all three categories and flattens the result", async () => {
    // Each category does a count then an insert; all three run in parallel, so
    // resolve by call order: watchlist count/insert, rated count/insert,
    // recs count/insert.
    mockExecute
      .mockResolvedValueOnce(rows([{ n: 5 }]))
      .mockResolvedValueOnce(rows([{ n: 5 }]))
      .mockResolvedValueOnce(rows([{ lifetime_rec_calls: 1 }]))
      .mockResolvedValueOnce(rows([{ badge_key: "watchlist_5" }]))
      .mockResolvedValueOnce(rows([{ badge_key: "rated_5" }]))
      .mockResolvedValueOnce(rows([{ badge_key: "recs_1" }]));

    const result = await awardAllBadges("user-1");

    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining(["watchlist_5", "rated_5", "recs_1"])
    );
  });

  it("returns [] when nothing qualifies", async () => {
    mockExecute
      .mockResolvedValueOnce(rows([{ n: 0 }]))
      .mockResolvedValueOnce(rows([{ n: 0 }]))
      .mockResolvedValueOnce(rows([{ lifetime_rec_calls: 0 }]));

    await expect(awardAllBadges("user-1")).resolves.toEqual([]);
  });
});
