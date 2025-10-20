// @/lib/recs.ts
export function slugTitle(raw: string) {
  if (!raw) return "";
  let s = raw.replace(/\(\s*\d{4}\s*\)/g, "").replace(/\b\d{4}\b/g, "");
  s = s.split(":")[0].split(" - ")[0];
  s = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

export function buildRecKey(payload: any) {
  const mode: "profile" | "seed" =
    payload?.mode === "seed" ? "seed" : "profile";
  if (mode === "profile") {
    const v = process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3";
    return `profile:${v}`;
  }
  const t = payload?.seed?.type ?? "unknown";
  const tmdb = payload?.seed?.external?.tmdbId;
  if (tmdb) return `seed:${t}:${tmdb}`;
  const slug = slugTitle(String(payload?.seed?.title ?? ""));
  return `seed:${t}:${slug || "unknown"}`;
}
