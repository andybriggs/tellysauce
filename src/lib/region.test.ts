import { describe, it, expect, beforeEach } from "vitest";
import {
  detectRegion,
  isSupportedRegion,
  storeRegion,
  regionOriginCountries,
  regionLabel,
  WATCH_REGION_KEY,
  DEFAULT_REGION,
} from "./region";

function setNavigatorLanguage(value: string) {
  Object.defineProperty(navigator, "language", { value, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  setNavigatorLanguage("en-GB");
});

describe("detectRegion", () => {
  it("prefers the stored region", () => {
    localStorage.setItem(WATCH_REGION_KEY, "CA");
    setNavigatorLanguage("en-US");
    expect(detectRegion()).toBe("CA");
  });

  it("falls back to the navigator.language suffix, uppercased", () => {
    setNavigatorLanguage("en-au");
    expect(detectRegion()).toBe("AU");
  });

  it("falls back to the default region when language has no country suffix", () => {
    setNavigatorLanguage("en");
    expect(detectRegion()).toBe(DEFAULT_REGION);
  });
});

describe("storeRegion", () => {
  it("round-trips through the shared key WhereToWatch has always used", () => {
    storeRegion("IE");
    expect(localStorage.getItem("watch_region")).toBe("IE");
    expect(detectRegion()).toBe("IE");
  });
});

describe("regionOriginCountries", () => {
  it("groups neighbouring markets so co-productions are not missed", () => {
    expect(regionOriginCountries("GB")).toEqual(["GB", "IE"]);
    expect(regionOriginCountries("AU")).toEqual(["AU", "NZ"]);
    expect(regionOriginCountries("US")).toEqual(["US", "CA"]);
  });

  it("is case insensitive", () => {
    expect(regionOriginCountries("gb")).toEqual(["GB", "IE"]);
  });

  it("falls back to the default group for unknown or missing codes", () => {
    expect(regionOriginCountries("ZZ")).toEqual(["GB", "IE"]);
    expect(regionOriginCountries(null)).toEqual(["GB", "IE"]);
    expect(regionOriginCountries(undefined)).toEqual(["GB", "IE"]);
  });
});

describe("regionLabel", () => {
  it("resolves ISO codes to display names", () => {
    expect(regionLabel("GB")).toBe("United Kingdom");
    expect(regionLabel("IE")).toBe("Ireland");
  });

  it("falls back to the default region's label when unresolved", () => {
    expect(regionLabel(null)).toBe("United Kingdom");
  });
});

describe("isSupportedRegion", () => {
  it("is true only for regions with a real origin-country mapping", () => {
    expect(isSupportedRegion("GB")).toBe(true);
    expect(isSupportedRegion("au")).toBe(true);
    expect(isSupportedRegion("NZ")).toBe(true);
  });

  it("is false for unmapped regions, so callers hide rather than mislabel", () => {
    expect(isSupportedRegion("NL")).toBe(false);
    expect(isSupportedRegion("JP")).toBe(false);
  });

  it("is false while the region is still unresolved", () => {
    expect(isSupportedRegion(null)).toBe(false);
    expect(isSupportedRegion(undefined)).toBe(false);
    expect(isSupportedRegion("")).toBe(false);
  });
});


