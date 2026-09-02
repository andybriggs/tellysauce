import { describe, it, expect } from "vitest";
import {
  BADGES,
  BADGE_BY_KEY,
  badgesFor,
  CATEGORY_LABELS,
  type BadgeCategory,
} from "./badges";

const CATEGORIES: BadgeCategory[] = ["watchlist", "rated", "recs"];

describe("badge catalogue", () => {
  it("defines 15 badges", () => {
    expect(BADGES).toHaveLength(15);
  });

  it("has unique keys", () => {
    const keys = BADGES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has 5 tiers per category", () => {
    for (const category of CATEGORIES) {
      expect(badgesFor(category)).toHaveLength(5);
    }
  });

  it("numbers tiers 1-5 within each category", () => {
    for (const category of CATEGORIES) {
      expect(badgesFor(category).map((b) => b.tier)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("orders thresholds strictly ascending within a category", () => {
    for (const category of CATEGORIES) {
      const thresholds = badgesFor(category).map((b) => b.threshold);
      const sorted = [...thresholds].sort((a, b) => a - b);
      expect(thresholds).toEqual(sorted);
      expect(new Set(thresholds).size).toBe(thresholds.length);
    }
  });

  it("resolves every key through BADGE_BY_KEY", () => {
    for (const badge of BADGES) {
      expect(BADGE_BY_KEY[badge.key]).toEqual(badge);
    }
  });

  it("gives every badge a name and unlock text", () => {
    for (const badge of BADGES) {
      expect(badge.name.length).toBeGreaterThan(0);
      expect(badge.unlockText.length).toBeGreaterThan(0);
    }
  });

  it("keeps rec thresholds reachable on the free tier", () => {
    // Free users get 3 lifetime generations, so tier 1 must be within that.
    const first = badgesFor("recs")[0];
    expect(first.threshold).toBeLessThanOrEqual(3);
  });

  it("labels every category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toBeTruthy();
    }
  });
});
