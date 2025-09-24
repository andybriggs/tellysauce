// app/lib/versionedStorage.ts
export type CacheEnvelope<T> = { v: string; data: T };

// 🔧 Bump this any time your cache shape changes.
// You can also set this via NEXT_PUBLIC_CACHE_VERSION if you prefer.
export const APP_CACHE_VERSION = process.env.NEXT_PUBLIC_CACHE_VERSION ?? "2";

// Read a versioned value. If the shape or version doesn't match, it's treated as a miss.
// By default, we DESTROY old cache on mismatch (as requested) and return fallback.
export function readVersioned<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);

    // Expected envelope: { v: string, data: T }
    if (
      parsed &&
      typeof parsed === "object" &&
      "v" in parsed &&
      "data" in parsed
    ) {
      const env = parsed as CacheEnvelope<T>;
      if (env.v === APP_CACHE_VERSION) return env.data;
      // Version mismatch → destroy old cache
      localStorage.removeItem(key);
      return fallback;
    }

    // Legacy/unwrapped payload → destroy old cache
    localStorage.removeItem(key);
    return fallback;
  } catch {
    // Corrupt JSON → destroy
    localStorage.removeItem(key);
    return fallback;
  }
}

// Write a versioned value
export function writeVersioned<T>(key: string, data: T) {
  const envelope: CacheEnvelope<T> = { v: APP_CACHE_VERSION, data };
  localStorage.setItem(key, JSON.stringify(envelope));
}

// Parse helper for storage events (we only want to accept same-version payloads)
export function parseEventValue<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed && parsed.v === APP_CACHE_VERSION) return parsed.data;
    return fallback;
  } catch {
    return fallback;
  }
}
