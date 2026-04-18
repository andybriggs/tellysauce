import { describe, it, expect, beforeEach } from "vitest";
import {
  readVersioned,
  writeVersioned,
  parseEventValue,
  APP_CACHE_VERSION,
} from "./versionedStorage";

// jsdom provides localStorage — reset between tests
beforeEach(() => {
  localStorage.clear();
});

describe("APP_CACHE_VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof APP_CACHE_VERSION).toBe("string");
    expect(APP_CACHE_VERSION.length).toBeGreaterThan(0);
  });
});

describe("writeVersioned", () => {
  it("stores a versioned envelope in localStorage", () => {
    writeVersioned("myKey", { foo: "bar" });
    const raw = localStorage.getItem("myKey");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveProperty("v", APP_CACHE_VERSION);
    expect(parsed).toHaveProperty("data", { foo: "bar" });
  });

  it("stores primitive values", () => {
    writeVersioned("numKey", 42);
    const raw = localStorage.getItem("numKey");
    const parsed = JSON.parse(raw!);
    expect(parsed.data).toBe(42);
  });

  it("stores arrays", () => {
    writeVersioned("arrKey", [1, 2, 3]);
    const raw = localStorage.getItem("arrKey");
    const parsed = JSON.parse(raw!);
    expect(parsed.data).toEqual([1, 2, 3]);
  });

  it("stores null", () => {
    writeVersioned("nullKey", null);
    const raw = localStorage.getItem("nullKey");
    const parsed = JSON.parse(raw!);
    expect(parsed.data).toBeNull();
  });
});

describe("readVersioned", () => {
  it("returns fallback when key does not exist", () => {
    expect(readVersioned("missing", "fallback")).toBe("fallback");
  });

  it("returns the stored data when version matches", () => {
    writeVersioned("k", { name: "test" });
    expect(readVersioned("k", null)).toEqual({ name: "test" });
  });

  it("returns fallback and removes key on version mismatch", () => {
    const staleEnvelope = JSON.stringify({ v: "old_version_xyz", data: { x: 1 } });
    localStorage.setItem("stale", staleEnvelope);

    const result = readVersioned("stale", "default");
    expect(result).toBe("default");
    expect(localStorage.getItem("stale")).toBeNull();
  });

  it("returns fallback and removes key for legacy (unwrapped) payload", () => {
    localStorage.setItem("legacy", JSON.stringify({ some: "plain object" }));

    const result = readVersioned<string>("legacy", "fb");
    expect(result).toBe("fb");
    expect(localStorage.getItem("legacy")).toBeNull();
  });

  it("returns fallback and removes key for corrupt JSON", () => {
    localStorage.setItem("corrupt", "not-valid-json{{{}");

    const result = readVersioned("corrupt", 99);
    expect(result).toBe(99);
    expect(localStorage.getItem("corrupt")).toBeNull();
  });

  it("returns fallback for non-object JSON (bare string without envelope)", () => {
    // A bare quoted string won't have 'v' or 'data' properties
    localStorage.setItem("bare", JSON.stringify("hello"));
    const result = readVersioned("bare", "fb");
    expect(result).toBe("fb");
    expect(localStorage.getItem("bare")).toBeNull();
  });

  it("round-trips complex objects correctly", () => {
    const obj = { a: 1, b: [true, null, "x"], c: { nested: true } };
    writeVersioned("complex", obj);
    expect(readVersioned("complex", null)).toEqual(obj);
  });

  it("returns fallback for null stored value (empty envelope data)", () => {
    writeVersioned("nullData", null);
    // null data is valid and should be returned, not treated as missing
    expect(readVersioned("nullData", "fb")).toBeNull();
  });
});

describe("parseEventValue", () => {
  it("returns fallback for null input", () => {
    expect(parseEventValue(null, "default")).toBe("default");
  });

  it("returns fallback for empty string", () => {
    expect(parseEventValue("", "default")).toBe("default");
  });

  it("returns data when version matches", () => {
    const envelope = JSON.stringify({ v: APP_CACHE_VERSION, data: { x: 42 } });
    expect(parseEventValue(envelope, null)).toEqual({ x: 42 });
  });

  it("returns fallback when version mismatches", () => {
    const envelope = JSON.stringify({ v: "wrong_version", data: { x: 42 } });
    expect(parseEventValue(envelope, "fb")).toBe("fb");
  });

  it("returns fallback for corrupt JSON", () => {
    expect(parseEventValue("{{bad json}}", "fb")).toBe("fb");
  });

  it("does NOT remove from localStorage (unlike readVersioned)", () => {
    const stale = JSON.stringify({ v: "old", data: 123 });
    localStorage.setItem("ev", stale);
    parseEventValue(stale, null);
    // parseEventValue is stateless — it doesn't touch localStorage
    expect(localStorage.getItem("ev")).toBe(stale);
  });
});
