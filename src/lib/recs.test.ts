import { describe, it, expect } from "vitest";
import { slugTitle, buildRecKey } from "./recs";

describe("slugTitle", () => {
  it("returns empty string for empty input", () => {
    expect(slugTitle("")).toBe("");
  });

  it("lowercases the title", () => {
    expect(slugTitle("Breaking Bad")).toBe("breaking bad");
  });

  it("removes year in parentheses", () => {
    expect(slugTitle("The Batman (2022)")).toBe("batman");
  });

  it("removes standalone 4-digit year", () => {
    expect(slugTitle("Breaking Bad 2008")).toBe("breaking bad");
  });

  it("strips subtitle after colon", () => {
    expect(slugTitle("Star Wars: A New Hope")).toBe("star wars");
  });

  it("strips subtitle after ' - '", () => {
    expect(slugTitle("Doctor Who - Series 1")).toBe("doctor who");
  });

  it("removes articles (the, a, an)", () => {
    expect(slugTitle("The Wire")).toBe("wire");
    expect(slugTitle("A Beautiful Mind")).toBe("beautiful mind");
    expect(slugTitle("An American Werewolf")).toBe("american werewolf");
  });

  it("converts & to 'and'", () => {
    expect(slugTitle("Law & Order")).toBe("law and order");
  });

  it("removes non-alphanumeric characters", () => {
    expect(slugTitle("It's Always Sunny!")).toBe("it s always sunny");
  });

  it("strips accents via NFKD normalization", () => {
    expect(slugTitle("Élite")).toBe("elite");
  });

  it("collapses multiple spaces", () => {
    expect(slugTitle("The   Wire")).toBe("wire");
  });

  it("trims leading/trailing spaces", () => {
    expect(slugTitle("  Succession  ")).toBe("succession");
  });

  it("handles title with only articles becoming empty", () => {
    expect(slugTitle("The A An")).toBe("");
  });
});

describe("buildRecKey", () => {
  describe("profile mode", () => {
    it("returns profile key with default version", () => {
      const key = buildRecKey({ mode: "profile" });
      expect(key).toMatch(/^profile:/);
    });

    it("uses provided version", () => {
      const key = buildRecKey({ mode: "profile", version: "42" });
      expect(key).toBe("profile:42");
    });

    it("falls back to env var then '3' when no version arg", () => {
      const key = buildRecKey({ mode: "profile" });
      // Should be profile:<something> — exact value depends on env
      expect(key).toMatch(/^profile:\w+/);
    });
  });

  describe("seed mode", () => {
    it("uses tmdbId when present", () => {
      const key = buildRecKey({
        mode: "seed",
        seed: {
          title: "Breaking Bad",
          type: "tv",
          external: { tmdbId: 1396 },
        },
      });
      expect(key).toBe("seed:tv:1396");
    });

    it("falls back to slugged title when no tmdbId", () => {
      const key = buildRecKey({
        mode: "seed",
        seed: {
          title: "Breaking Bad",
          type: "tv",
        },
      });
      expect(key).toBe("seed:tv:breaking bad");
    });

    it("uses 'unknown' type when type is missing", () => {
      const key = buildRecKey({
        mode: "seed",
        seed: { title: "Some Show" },
      });
      expect(key).toBe("seed:unknown:some show");
    });

    it("uses 'unknown' slug when title slugifies to empty", () => {
      const key = buildRecKey({
        mode: "seed",
        seed: { title: "The A An", type: "tv" },
      });
      expect(key).toBe("seed:tv:unknown");
    });

    it("prefers tmdbId over slug even when title is set", () => {
      const key = buildRecKey({
        mode: "seed",
        seed: {
          title: "Some Movie (2022): Subtitle",
          type: "movie",
          external: { tmdbId: 9999 },
        },
      });
      expect(key).toBe("seed:movie:9999");
    });

    it("ignores tmdbId of 0 (falsy check — actually 0 is a valid number)", () => {
      // 0 is typeof 'number' so it SHOULD be used as the key
      const key = buildRecKey({
        mode: "seed",
        seed: {
          title: "Something",
          type: "movie",
          external: { tmdbId: 0 },
        },
      });
      expect(key).toBe("seed:movie:0");
    });
  });
});
