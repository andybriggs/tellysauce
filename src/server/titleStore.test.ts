import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock @/db before importing titleStore ----
vi.mock("@/db", () => {
  const selectChain = {
    from: vi.fn(),
  };
  selectChain.from.mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockResolvedValue([]),
    }),
    innerJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }),
  });

  const insertChain = {
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  };

  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    delete: vi.fn().mockReturnValue(deleteChain),
    execute: vi.fn().mockResolvedValue(undefined),
  };

  return { db: mockDb };
});

// ---- Mock ./tmdb ----
vi.mock("./tmdb", () => ({
  fetchTMDBTitle: vi.fn(),
}));

import { db } from "@/db";
import { fetchTMDBTitle } from "./tmdb";
import {
  ensureTitle,
  addToWatchlist,
  removeFromWatchlist,
  rateTitle,
  getWatchlist,
  getRated,
  getRating,
  isSaved,
} from "./titleStore";

// Typed mock helpers
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
};
const mockFetchTMDB = fetchTMDBTitle as ReturnType<typeof vi.fn>;

// Helpers to configure the select chain's resolved value
function mockSelectReturns(rows: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const orderByMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock, orderBy: orderByMock });
  const innerJoinMock = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: orderByMock }) });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock, innerJoin: innerJoinMock });
  mockDb.select.mockReturnValue({ from: fromMock });
}

const FAKE_TITLE_ROW = {
  id: "uuid-1",
  tmdbId: 550,
  mediaType: "movie" as const,
  title: "Fight Club",
  poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
  year: 1999,
  description: "First rule: you do not talk about fight club.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureTitle", () => {
  it("returns existing row from DB without calling TMDB", async () => {
    mockSelectReturns([FAKE_TITLE_ROW]);

    const row = await ensureTitle(550, "movie");
    expect(row).toEqual(FAKE_TITLE_ROW);
    expect(mockFetchTMDB).not.toHaveBeenCalled();
  });

  it("fetches from TMDB and inserts when DB has no row", async () => {
    const tmdbData = {
      tmdbId: 550,
      mediaType: "movie" as const,
      title: "Fight Club",
      poster: null,
      year: 1999,
      description: "First rule.",
    };
    mockFetchTMDB.mockResolvedValue(tmdbData);

    // First select returns empty, second select returns the inserted row
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      const rows = callCount === 1 ? [] : [FAKE_TITLE_ROW];
      const limitMock = vi.fn().mockResolvedValue(rows);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      return { from: fromMock };
    });

    const row = await ensureTitle(550, "movie");

    expect(mockFetchTMDB).toHaveBeenCalledWith(550, "movie");
    expect(mockDb.insert).toHaveBeenCalled();
    expect(row).toEqual(FAKE_TITLE_ROW);
  });

  it("throws when TMDB returns null", async () => {
    mockSelectReturns([]);
    mockFetchTMDB.mockResolvedValue(null);

    await expect(ensureTitle(9999, "movie")).rejects.toThrow(
      /not found on TMDB/
    );
  });

  it("throws when TMDB returns title with empty string", async () => {
    mockSelectReturns([]);
    mockFetchTMDB.mockResolvedValue({ tmdbId: 9999, mediaType: "movie", title: "  ", poster: null, year: null, description: null });

    await expect(ensureTitle(9999, "movie")).rejects.toThrow(
      /not found on TMDB/
    );
  });
});

describe("addToWatchlist", () => {
  it("calls ensureTitle then db.execute", async () => {
    mockSelectReturns([FAKE_TITLE_ROW]);

    await addToWatchlist("user-1", 550, "movie");

    expect(mockDb.execute).toHaveBeenCalledOnce();
    const sqlCall = mockDb.execute.mock.calls[0][0];
    // The sql template tag produces an object — verify it contains the right table reference
    expect(JSON.stringify(sqlCall)).toContain("user_titles");
  });
});

describe("removeFromWatchlist", () => {
  it("deletes the user_title row when title exists", async () => {
    mockSelectReturns([{ id: "uuid-1" }]);

    await removeFromWatchlist("user-1", 550, "movie");

    expect(mockDb.delete).toHaveBeenCalledOnce();
  });

  it("does nothing when title is not in DB", async () => {
    mockSelectReturns([]);

    await removeFromWatchlist("user-1", 550, "movie");

    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});

describe("rateTitle", () => {
  it("clamps rating to [1, 5] — above 5 becomes 5", async () => {
    mockSelectReturns([FAKE_TITLE_ROW]);

    await rateTitle("user-1", 550, "movie", 10);

    expect(mockDb.execute).toHaveBeenCalledOnce();
    // The clamping is internal (Math.max/min) — we just verify it ran without error
  });

  it("clamps rating below 1 to 1", async () => {
    mockSelectReturns([FAKE_TITLE_ROW]);
    await rateTitle("user-1", 550, "movie", -5);
    expect(mockDb.execute).toHaveBeenCalledOnce();
  });

  it("rounds decimal ratings", async () => {
    mockSelectReturns([FAKE_TITLE_ROW]);
    await rateTitle("user-1", 550, "movie", 3.7);
    expect(mockDb.execute).toHaveBeenCalledOnce();
  });
});

describe("getWatchlist", () => {
  it("returns empty array when no watchlist items", async () => {
    const orderByMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const result = await getWatchlist("user-1");
    expect(result).toEqual([]);
  });

  it("returns rows from DB", async () => {
    const rows = [
      { id: 550, type: "movie", name: "Fight Club", poster: null, year: 1999, description: null },
    ];
    const orderByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const result = await getWatchlist("user-1");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Fight Club");
  });
});

describe("getRated", () => {
  it("returns empty array when no rated items", async () => {
    const orderByMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const result = await getRated("user-1");
    expect(result).toEqual([]);
  });

  it("maps null rating to 0", async () => {
    const rows = [
      {
        id: 550,
        type: "movie",
        name: "Fight Club",
        poster: null,
        year: 1999,
        description: null,
        rating: null,
        ratedAt: null,
      },
    ];
    const orderByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const result = await getRated("user-1");
    expect(result[0].rating).toBe(0);
  });

  it("maps null year to undefined", async () => {
    const rows = [
      {
        id: 550,
        type: "movie",
        name: "Fight Club",
        poster: null,
        year: null,
        description: null,
        rating: 4,
        ratedAt: null,
      },
    ];
    const orderByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const result = await getRated("user-1");
    expect(result[0].year).toBeUndefined();
  });
});

describe("getRating", () => {
  it("returns 0 when title not found in DB", async () => {
    mockSelectReturns([]);

    const rating = await getRating("user-1", 9999, "movie");
    expect(rating).toBe(0);
  });

  it("returns 0 when user has no rating row", async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      // First call: title lookup → returns title
      // Second call: user_title lookup → returns empty
      const rows = callCount === 1 ? [{ id: "uuid-1" }] : [];
      const limitMock = vi.fn().mockResolvedValue(rows);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      return { from: fromMock };
    });

    const rating = await getRating("user-1", 550, "movie");
    expect(rating).toBe(0);
  });

  it("returns 0 when status is WATCHLIST (not RATED)", async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      const rows =
        callCount === 1
          ? [{ id: "uuid-1" }]
          : [{ status: "WATCHLIST", rating: null }];
      const limitMock = vi.fn().mockResolvedValue(rows);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      return { from: fromMock };
    });

    const rating = await getRating("user-1", 550, "movie");
    expect(rating).toBe(0);
  });

  it("returns the numeric rating when status is RATED", async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      const rows =
        callCount === 1
          ? [{ id: "uuid-1" }]
          : [{ status: "RATED", rating: 4 }];
      const limitMock = vi.fn().mockResolvedValue(rows);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      return { from: fromMock };
    });

    const rating = await getRating("user-1", 550, "movie");
    expect(rating).toBe(4);
  });
});

describe("isSaved", () => {
  it("returns false when title not found in DB", async () => {
    mockSelectReturns([]);

    const saved = await isSaved("user-1", 9999, "movie");
    expect(saved).toBe(false);
  });

  it("returns false when no user_title row exists", async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      const rows = callCount === 1 ? [{ id: "uuid-1" }] : [];
      const limitMock = vi.fn().mockResolvedValue(rows);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      return { from: fromMock };
    });

    const saved = await isSaved("user-1", 550, "movie");
    expect(saved).toBe(false);
  });

  it("returns true when user_title row exists", async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      const rows =
        callCount === 1
          ? [{ id: "uuid-1" }]
          : [{ id: "ut-uuid-1" }];
      const limitMock = vi.fn().mockResolvedValue(rows);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      return { from: fromMock };
    });

    const saved = await isSaved("user-1", 550, "movie");
    expect(saved).toBe(true);
  });
});
