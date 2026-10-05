import { describe, it, expect } from "vitest";
import {
  dropEvergreenSeries,
  mergePages,
  daysAgo,
  today,
  EVERGREEN_MAX_AGE_YEARS,
} from "./discover";

const NOW = new Date("2026-10-05T00:00:00Z");

describe("dropEvergreenSeries", () => {
  it("drops decades-old continuing series but keeps recent shows", () => {
    const results = [
      { id: 1, name: "Slow Horses", first_air_date: "2022-04-01" },
      { id: 2, name: "Coronation Street", first_air_date: "1960-12-09" },
      { id: 3, name: "Vigil", first_air_date: "2021-08-29" },
      { id: 4, name: "The Simpsons", first_air_date: "1989-12-17" },
      { id: 5, name: "Colin from Accounts", first_air_date: "2022-12-01" },
    ];
    expect(dropEvergreenSeries(results, NOW).map((r) => r.name)).toEqual([
      "Slow Horses",
      "Vigil",
      "Colin from Accounts",
    ]);
  });

  it("keeps a show exactly on the cutoff year", () => {
    const cutoff = NOW.getFullYear() - EVERGREEN_MAX_AGE_YEARS;
    const results = [{ id: 1, first_air_date: `${cutoff}-01-01` }];
    expect(dropEvergreenSeries(results, NOW)).toHaveLength(1);
  });

  it("keeps entries with a missing or unparseable date rather than dropping them", () => {
    const results = [
      { id: 1, first_air_date: null },
      { id: 2, first_air_date: "" },
      { id: 3 },
    ];
    expect(dropEvergreenSeries(results, NOW)).toHaveLength(3);
  });
});

describe("mergePages", () => {
  it("concatenates pages and removes duplicate ids", () => {
    const merged = mergePages([
      { results: [{ id: 1 }, { id: 2 }] },
      { results: [{ id: 2 }, { id: 3 }] },
    ]);
    expect(merged.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("tolerates pages with no results", () => {
    expect(mergePages([{}, { results: [{ id: 7 }] }]).map((r) => r.id)).toEqual([7]);
  });
});

describe("date helpers", () => {
  it("formats today as YYYY-MM-DD", () => {
    expect(today(NOW)).toBe("2026-10-05");
  });

  it("formats a backdated window boundary", () => {
    expect(daysAgo(90, NOW)).toBe("2026-07-07");
  });
});
