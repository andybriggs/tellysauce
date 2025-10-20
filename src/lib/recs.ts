import { SeedInput } from "@/types";

type BuildProfileKey = { mode: "profile"; version?: string };
type BuildSeedKey = { mode: "seed"; seed: SeedInput };

export type BuildRecKeyArgs = BuildProfileKey | BuildSeedKey;

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

export function buildRecKey(payload: BuildRecKeyArgs): string {
  if (payload.mode === "profile") {
    const v = payload.version ?? process.env.NEXT_PUBLIC_CACHE_VERSION ?? "3";
    return `profile:${v}`;
  }

  const t = payload.seed.type ?? "unknown";
  const tmdb = payload.seed.external?.tmdbId;
  if (typeof tmdb === "number") return `seed:${t}:${tmdb}`;
  const slug = slugTitle(payload.seed.title);
  return `seed:${t}:${slug || "unknown"}`;
}
