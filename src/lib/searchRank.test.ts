import { describe, it, expect } from "vitest";
import { normaliseTitle, rankSearchResults, titleMatchScore } from "./searchRank";

const titles = (items: { title: string }[]) => items.map((i) => i.title);

describe("normaliseTitle", () => {
  it("lowercases, strips accents and punctuation, and spells out &", () => {
    expect(normaliseTitle("Amélie")).toBe("amelie");
    expect(normaliseTitle("The Pirates! In an Adventure")).toBe("the pirates in an adventure");
    expect(normaliseTitle("Peter Pan & the Pirates")).toBe("peter pan and the pirates");
    expect(normaliseTitle("Schindler's List")).toBe("schindlers list");
  });
});

describe("titleMatchScore", () => {
  it("ranks match types in order", () => {
    const q = "The Pirates";
    const exact = titleMatchScore(q, "The Pirates");
    const prefix = titleMatchScore(q, "The Pirates of Somalia");
    const near = titleMatchScore(q, "Pirates of the Caribbean");
    const allWords = titleMatchScore(q, "Jake and the Never Land Pirates");
    const none = titleMatchScore(q, "Slow Horses");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(allWords);
    expect(allWords).toBeGreaterThan(none);
    expect(none).toBe(0);
  });

  it("treats a missing leading article as exact", () => {
    expect(titleMatchScore("office", "The Office")).toBe(titleMatchScore("the office", "The Office!"));
  });

  it("matches a half-typed last word as a prefix", () => {
    expect(titleMatchScore("the pir", "The Pirates")).toBe(titleMatchScore("the pirates", "The Pirates of Somalia"));
  });
});

describe("rankSearchResults", () => {
  // TMDB's actual page-1 order for "The Pirates!" (vote counts as returned).
  const tmdbOrder = [
    { title: "Jake and the Never Land Pirates", voteCount: 67 },
    { title: "Peter Pan & the Pirates", voteCount: 6 },
    { title: "Pirates of the Caribbean: The Curse of the Black Pearl", voteCount: 23102 },
    { title: "The Pirates of Dark Water", voteCount: 42 },
    { title: "The Pirates", voteCount: 244 },
    { title: "The Ice Pirates", voteCount: 230 },
    { title: "The Pirates! In an Adventure with Scientists!", voteCount: 1273 },
  ];

  it("puts the literal match first when the query has punctuation", () => {
    expect(titles(rankSearchResults("The Pirates!", tmdbOrder)).slice(0, 2)).toEqual([
      "The Pirates! In an Adventure with Scientists!",
      "The Pirates",
    ]);
  });

  it("puts the exact title first without punctuation", () => {
    const ranked = titles(rankSearchResults("The Pirates", tmdbOrder));
    expect(ranked[0]).toBe("The Pirates");
    expect(ranked.indexOf("The Pirates of Dark Water")).toBeLessThan(
      ranked.indexOf("Pirates of the Caribbean: The Curse of the Black Pearl")
    );
    expect(ranked.at(-1)).toBe("Jake and the Never Land Pirates");
  });

  it("lets a much better-known title climb one tier, but no further", () => {
    const ranked = titles(
      rankSearchResults("dune", [
        { title: "Dune", voteCount: 3 },
        { title: "Dune: Part Two", voteCount: 8976 },
        { title: "Frank Herbert's Dune", voteCount: 392 },
      ])
    );
    expect(ranked).toEqual(["Dune: Part Two", "Dune", "Frank Herbert's Dune"]);

    const caribbean = titles(
      rankSearchResults("The Pirates", [
        { title: "Pirates of the Caribbean: At World's End", voteCount: 16065 },
        { title: "The Pirates", voteCount: 0 },
      ])
    );
    expect(caribbean[0]).toBe("The Pirates");
  });

  it("keeps TMDB's order for ties", () => {
    const items = [
      { title: "The Bear", voteCount: 0 },
      { title: "The Bear", voteCount: 0 },
    ].map((x, i) => ({ ...x, id: i }));
    expect(rankSearchResults("the bear", items).map((x) => x.id)).toEqual([0, 1]);
  });
});
