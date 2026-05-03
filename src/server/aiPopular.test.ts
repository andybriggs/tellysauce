import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }));

vi.mock("@/db", () => ({
  db: { execute: mockExecute },
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

import { fetchAiPopularTitles, fetchAiPopularData } from "./aiPopular";

const movieRows = [
  { tmdb_id: 603, title: "The Matrix", poster: "/matrix.jpg", year: 1999, description: "A hacker discovers reality." },
  { tmdb_id: 278, title: "The Shawshank Redemption", poster: "/shawshank.jpg", year: 1994, description: null },
];

const tvRows = [
  { tmdb_id: 1396, title: "Breaking Bad", poster: "/bb.jpg", year: 2008, description: "Chemistry teacher." },
];

describe("fetchAiPopularTitles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns mapped Title[] for movies", async () => {
    mockExecute.mockResolvedValue({ rows: movieRows });

    const result = await fetchAiPopularTitles("movie");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 603,
      type: "movie",
      name: "The Matrix",
      poster: "/matrix.jpg",
      year: 1999,
      description: "A hacker discovers reality.",
      rating: 0,
    });
  });

  it("coerces null description to empty string", async () => {
    mockExecute.mockResolvedValue({ rows: movieRows });

    const result = await fetchAiPopularTitles("movie");

    expect(result[1].description).toBe("");
  });

  it("returns mapped Title[] for tv with correct type field", async () => {
    mockExecute.mockResolvedValue({ rows: tvRows });

    const result = await fetchAiPopularTitles("tv");

    expect(result[0].type).toBe("tv");
    expect(result[0].name).toBe("Breaking Bad");
  });

  it("returns empty array when rows is empty", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    const result = await fetchAiPopularTitles("movie");

    expect(result).toEqual([]);
  });

  it("returns empty array when db throws", async () => {
    mockExecute.mockRejectedValue(new Error("DB connection failed"));

    const result = await fetchAiPopularTitles("movie");

    expect(result).toEqual([]);
  });

  it("returns empty array when rows is undefined", async () => {
    mockExecute.mockResolvedValue({});

    const result = await fetchAiPopularTitles("tv");

    expect(result).toEqual([]);
  });
});

describe("fetchAiPopularData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns aiReason and redditQuotes when row exists", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ ai_reason: "Trending on Reddit", reddit_quotes: [{ text: "Amazing show", subreddit: "r/tv" }] }],
    });

    const result = await fetchAiPopularData(1396, "tv");

    expect(result).toEqual({
      aiReason: "Trending on Reddit",
      redditQuotes: [{ text: "Amazing show", subreddit: "r/tv" }],
    });
  });

  it("returns null aiReason when ai_reason is null", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ ai_reason: null, reddit_quotes: [] }],
    });

    const result = await fetchAiPopularData(603, "movie");

    expect(result?.aiReason).toBeNull();
  });

  it("returns empty redditQuotes when reddit_quotes is not an array", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ ai_reason: "Popular", reddit_quotes: null }],
    });

    const result = await fetchAiPopularData(603, "movie");

    expect(result?.redditQuotes).toEqual([]);
  });

  it("returns null when no row found for the title", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    const result = await fetchAiPopularData(99999, "movie");

    expect(result).toBeNull();
  });

  it("returns null when db throws", async () => {
    mockExecute.mockRejectedValue(new Error("DB error"));

    const result = await fetchAiPopularData(1396, "tv");

    expect(result).toBeNull();
  });
});
