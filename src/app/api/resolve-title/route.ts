import { NextResponse } from "next/server";

/* =========================
   Types
   ========================= */

type MediaKind = "movie" | "tv";
type Lang = string; // e.g. "en-GB"
type Region = string; // e.g. "GB"

type TMDBMovieHit = {
  id: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  vote_count?: number;
  media_type?: "movie";
};

type TMDBTVHit = {
  id: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  vote_count?: number;
  media_type?: "tv";
};

type TMDBPersonHit = { media_type: "person" };

type TMDBMultiResult = TMDBMovieHit | TMDBTVHit | TMDBPersonHit;
type TMDBPaged<T> = { page?: number; results?: T[] };

type TMDBFindResponse = {
  movie_results?: TMDBMovieHit[];
  tv_results?: TMDBTVHit[];
};

export type ResolveResultItem = {
  id: number;
  name: string;
  originalName?: string;
  type: MediaKind;
  year?: number;
  poster?: string | null;
  backdrop?: string | null;
  popularity?: number;
  overview?: string;
  voteCount?: number;
  score: number;
};

/* =========================
   Constants & Helpers
   ========================= */

const IMG = {
  poster: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w185${p}` : null,
  backdrop: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w300${p}` : null,
};

const HEADERS = (token: string) => ({
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
});

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "to",
  "with",
  "for",
  "on",
  "at",
  "by",
  "from",
  "into",
  "about",
  "as",
  "is",
  "it",
  "this",
  "that",
  "these",
  "those",
  "be",
  "are",
  "was",
  "were",
]);

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normTitle(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeFlexible(s: string): string[] {
  const base = stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const parts = base.split(/\s+/);
  if (parts.length <= 2) return parts.filter((w) => w && !STOP.has(w));
  return parts.filter((w) => w.length > 2 && !STOP.has(w));
}

function extractYear(date?: string): number | undefined {
  return date && date.length >= 4 ? Number(date.slice(0, 4)) : undefined;
}

function keywordOverlapScore(target: string, keywords: string[]): number {
  if (!keywords.length || !target) return 0;
  const textTokens = new Set(tokenizeFlexible(target));
  let hits = 0;
  for (const k of keywords) if (textTokens.has(k)) hits++;
  return hits * 6;
}

function buildKeywords(desc: string, tagsCsv: string): string[] {
  const tagTokens = tagsCsv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const descTokens = tokenizeFlexible(desc);
  const all = [...descTokens, ...tagTokens];
  return Array.from(new Set(all)).slice(0, 20);
}

function titleSimilarityScore(q: string, ...cands: string[]) {
  const nq = normTitle(q);
  let best = 0;
  for (const c of cands) {
    const ni = normTitle(c);
    if (!ni) continue;
    if (ni === nq) best = Math.max(best, 100);
    else if (ni.startsWith(nq)) best = Math.max(best, 65);
    else if (ni.includes(nq)) best = Math.max(best, 45);
    else {
      const qt = new Set(nq.split(" ").filter(Boolean));
      const it = new Set(ni.split(" ").filter(Boolean));
      const inter = [...qt].filter((t) => it.has(t)).length;
      const union = new Set([...qt, ...it]).size;
      const j = union ? inter / union : 0;
      best = Math.max(best, Math.round(40 * j));
    }
  }
  return best;
}

/* ----- Type guards to avoid 'any' ----- */
function isMovieHit(hit: TMDBMovieHit | TMDBTVHit): hit is TMDBMovieHit {
  return (
    (hit as TMDBMovieHit).title !== undefined || hit.media_type === "movie"
  );
}

function toResultItem(hit: TMDBMovieHit | TMDBTVHit): ResolveResultItem {
  const isMovie = isMovieHit(hit);
  const name = isMovie ? hit.title ?? "" : (hit as TMDBTVHit).name ?? "";
  const originalName = isMovie
    ? hit.original_title ?? ""
    : (hit as TMDBTVHit).original_name ?? "";
  const date = isMovie ? hit.release_date : (hit as TMDBTVHit).first_air_date;
  const year = extractYear(date);

  return {
    id: hit.id,
    name,
    originalName,
    type: isMovie ? "movie" : "tv",
    year,
    poster: IMG.poster(hit.poster_path ?? null),
    backdrop: IMG.backdrop(hit.backdrop_path ?? null),
    popularity: hit.popularity ?? 0,
    overview: hit.overview ?? "",
    voteCount: hit.vote_count ?? 0,
    score: 0,
  };
}

function scoreItem(
  item: ResolveResultItem,
  q: string,
  queryYear?: number,
  preferKind?: MediaKind | null,
  keywords: string[] = []
): number {
  let s = 0;

  // Title similarity (name + original name)
  s += titleSimilarityScore(q, item.name, item.originalName ?? "");

  // Year closeness (heavier if AI provided a year)
  if (queryYear && item.year) {
    const diff = Math.abs(queryYear - item.year);
    if (diff === 0) s += 45;
    else if (diff === 1) s += item.type === "tv" ? 25 : 10;
    else if (diff === 2) s += 6;
    else s -= diff * 4;
  }

  // Kind preference
  if (preferKind && item.type === preferKind) s += 10;

  // Popularity / vote count tiny tie-breakers
  s += Math.min(10, (item.popularity ?? 0) / 50);
  if ((item.voteCount ?? 0) > 0)
    s += Math.min(8, Math.log2((item.voteCount ?? 0) + 1));

  // Keywords
  if (keywords.length) {
    s += keywordOverlapScore(item.name, keywords) * 1.4;
    s += keywordOverlapScore(item.overview ?? "", keywords) * 0.8;
  }

  return s;
}

function isSaneCandidate(item: ResolveResultItem, q: string): boolean {
  const nq = normTitle(q);
  const ni = normTitle(item.name);
  const qTokens = new Set(nq.split(" ").filter(Boolean));
  const iTokens = new Set(ni.split(" ").filter(Boolean));
  const inter = [...qTokens].filter((t) => iTokens.has(t)).length;

  if (qTokens.size <= 2 && inter === 0) return false;

  const goodTitle = ni === nq || ni.startsWith(nq);
  const enoughVotes = (item.voteCount ?? 0) >= 5;
  if (!goodTitle && !enoughVotes) return false;

  return true;
}

function dedupe(items: ResolveResultItem[]) {
  const seen = new Set<string>();
  const out: ResolveResultItem[] = [];
  for (const it of items) {
    const key = `${normTitle(it.name)}|${it.year ?? "?"}|${it.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

function yearTolerance(kind: MediaKind) {
  return kind === "tv" ? 1 : 0;
}

function isYearCompatible(
  item: ResolveResultItem,
  y: number,
  preferKind?: MediaKind | null
) {
  if (item.year == null) return false;
  const tol = preferKind
    ? yearTolerance(preferKind)
    : item.type === "tv"
    ? 1
    : 0;
  return Math.abs(item.year - y) <= tol;
}

function exactMatchFirst(
  pool: ResolveResultItem[],
  q: string,
  y?: number,
  preferKind?: MediaKind | null
) {
  const nq = normTitle(q);
  const cand = preferKind ? pool.filter((p) => p.type === preferKind) : pool;
  const exact = cand.find((p) => {
    const ni = normTitle(p.name);
    const yOk =
      y == null
        ? true
        : p.year != null &&
          Math.abs((p.year ?? 0) - y) <= (p.type === "tv" ? 1 : 0);
    return ni === nq && yOk;
  });
  return exact || null;
}

function parseImdbId(s?: string | null): string | null {
  if (!s) return null;
  const m = s.match(/(tt\d{7,8})/i);
  return m ? m[1] : null;
}

/* =========================
   Network: tiny retry helper
   ========================= */

async function fetchJSON<T>(
  url: string,
  headers: Record<string, string>,
  retries = 2
): Promise<T | null> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const r = await fetch(url, { headers, cache: "no-store" });
      if (r.ok) return (await r.json()) as T;
      if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
        await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
        attempt++;
        continue;
      }
      return null;
    } catch {
      await new Promise((res) => setTimeout(res, 200 * (attempt + 1)));
      attempt++;
    }
  }
  return null;
}

/* =========================
   Handler
   ========================= */

export async function GET(req: Request) {
  // Local helpers for this handler
  function parseYearAnywhere(
    ...inputs: (string | undefined | null)[]
  ): number | undefined {
    for (const s of inputs) {
      if (!s) continue;
      const m = s.match(/\b(19|20)\d{2}\b/);
      if (m) return Number(m[0]);
    }
    return undefined;
  }
  function inferKindFromContext(
    desc?: string,
    tagsCsv?: string
  ): MediaKind | null {
    const blob = `${desc || ""} ${tagsCsv || ""}`.toLowerCase();
    const isTV = /\b(tv|series|mini-?series|season|episode|show)\b/.test(blob);
    const isMovie = /\b(film|feature|movie)\b/.test(blob);
    if (isTV && !isMovie) return "tv";
    if (isMovie && !isTV) return "movie";
    return null;
  }

  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  const kindParam = (searchParams.get("kind") as MediaKind | null) ?? null;
  const typesParam = (searchParams.get("types") || "movie,tv").toLowerCase();
  const yearParam = searchParams.get("year"); // AI-provided year preferred
  const imdbParam = searchParams.get("imdbId"); // can be ttID or full URL
  const language: Lang | undefined = searchParams.get("language") || undefined;
  const region: Region | undefined = searchParams.get("region") || undefined;

  // additional optional context for scoring
  const desc = (searchParams.get("desc") || "").trim();
  const tagsParam = (searchParams.get("tags") || "").trim();

  const minScore = Number(searchParams.get("minScore") || "85"); // base floor
  const gapMin = 8; // dynamic confidence gap

  if (!qRaw && !imdbParam) {
    return NextResponse.json({ error: "Missing q or imdbId" }, { status: 400 });
  }

  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TMDB_ACCESS_TOKEN not configured" },
      { status: 500 }
    );
  }

  const allowMovie = typesParam.includes("movie");
  const allowTV = typesParam.includes("tv");

  // If we have an IMDb id or URL, resolve directly (exact match).
  const imdbId = parseImdbId(imdbParam);
  if (imdbId && /^tt\d+$/i.test(imdbId)) {
    const found = await findByImdb(imdbId, token, language, region);
    if (found) {
      return NextResponse.json({
        id: found.id,
        kind: found.type,
        results: [{ ...found, score: 1000 }],
      });
    }
    // fall through to text search if /find returns nothing
  }

  const q = qRaw;

  // Prefer explicit year param, else look in q, tags, then desc
  const aiYear = yearParam ? Number(yearParam) : undefined;
  const queryYear = Number.isFinite(aiYear as number)
    ? aiYear
    : parseYearAnywhere(qRaw, tagsParam, desc);

  // Prefer provided kind, else infer from context
  const preferKind: MediaKind | null =
    kindParam ?? inferKindFromContext(desc, tagsParam);

  const keywords = buildKeywords(desc, tagsParam);

  // Prefer typed endpoints; pass year filters directly to TMDB
  let pool: ResolveResultItem[] = [];
  if (allowMovie || allowTV) {
    const [movies, tv] = await Promise.all([
      allowMovie
        ? searchMovie(q, token, language, region, queryYear)
        : Promise.resolve<ResolveResultItem[]>([]),
      allowTV
        ? searchTV(q, token, language, region, queryYear)
        : Promise.resolve<ResolveResultItem[]>([]),
    ]);
    pool = [...movies, ...tv];
  } else {
    pool = await searchMulti(q, token, language, region);
  }

  // Dedupe + basic sanity
  pool = dedupe(pool).filter((it) => isSaneCandidate(it, q));

  // STRICT YEAR FILTER (if AI/context year provided)
  let usedStrictYear = false;
  if (queryYear != null) {
    const strictlyYearCompatible = pool.filter((it) =>
      isYearCompatible(it, queryYear, preferKind ?? undefined)
    );
    if (strictlyYearCompatible.length > 0) {
      pool = strictlyYearCompatible;
      usedStrictYear = true;
    }
    // If none survive, keep original pool (soft fallback), but we will not mark the result as confident unless top matches year.
  }

  if (pool.length === 0) {
    return NextResponse.json({ id: null, kind: null, results: [] });
  }

  // Exact-match early exit (respects year compatibility if year provided)
  const exact = exactMatchFirst(pool, q, queryYear, preferKind);
  if (exact) {
    return NextResponse.json({
      id: exact.id,
      kind: exact.type,
      results: [{ ...exact, score: 1000 }],
    });
  }

  // Score
  const ranked = pool
    .map((it) => ({
      ...it,
      score: scoreItem(it, q, queryYear, preferKind, keywords),
    }))
    .sort((a, b) => b.score - a.score);

  const [best, second] = ranked;

  // Confidence rules:
  const meetsBase =
    best &&
    best.score >= minScore &&
    (!second || best.score - second.score >= gapMin);
  let confident = !!meetsBase;

  if (!usedStrictYear && queryYear != null) {
    const bestYearOK =
      best?.year != null &&
      Math.abs((best.year ?? 0) - queryYear) <= (best?.type === "tv" ? 1 : 0);
    confident = !!(meetsBase && bestYearOK);
  }

  return NextResponse.json({
    id: confident ? best?.id ?? null : null,
    kind: confident ? best?.type ?? null : null,
    results: ranked,
  });
}

/* =========================
   TMDB calls
   ========================= */

async function findByImdb(
  imdbId: string,
  token: string,
  language?: Lang,
  region?: Region
): Promise<ResolveResultItem | null> {
  const url = new URL(
    `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}`
  );
  url.searchParams.set("external_source", "imdb_id");
  if (language) url.searchParams.set("language", language);
  if (region) url.searchParams.set("region", region);

  const data = await fetchJSON<TMDBFindResponse>(
    url.toString(),
    HEADERS(token)
  );
  if (!data) return null;

  const movie = data.movie_results?.[0];
  if (movie) return toResultItem({ ...movie, media_type: "movie" });
  const tv = data.tv_results?.[0];
  if (tv) return toResultItem({ ...tv, media_type: "tv" });
  return null;
}

async function searchMulti(
  q: string,
  token: string,
  language: Lang | undefined,
  region: Region | undefined
): Promise<ResolveResultItem[]> {
  const url = new URL("https://api.themoviedb.org/3/search/multi");
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  if (language) url.searchParams.set("language", language);
  if (region) url.searchParams.set("region", region);

  const data = await fetchJSON<TMDBPaged<TMDBMultiResult>>(
    url.toString(),
    HEADERS(token)
  );
  if (!data) return [];

  const hits = (data.results ?? []).filter(
    (x): x is TMDBMovieHit | TMDBTVHit =>
      x.media_type !== "person" &&
      (("title" in x && typeof (x as TMDBMovieHit).title !== "undefined") ||
        ("name" in x && typeof (x as TMDBTVHit).name !== "undefined"))
  );

  return hits.map((h) => toResultItem(h));
}

async function searchMovie(
  q: string,
  token: string,
  language?: Lang,
  region?: Region,
  year?: number
): Promise<ResolveResultItem[]> {
  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  if (language) url.searchParams.set("language", language);
  if (region) url.searchParams.set("region", region);
  if (year) {
    url.searchParams.set("primary_release_year", String(year));
    // url.searchParams.set("year", String(year)); // optional
  }

  const data = await fetchJSON<TMDBPaged<TMDBMovieHit>>(
    url.toString(),
    HEADERS(token)
  );
  if (!data) return [];
  return (data.results ?? []).map((h) =>
    toResultItem({ ...h, media_type: "movie" })
  );
}

async function searchTV(
  q: string,
  token: string,
  language?: Lang,
  region?: Region,
  year?: number
): Promise<ResolveResultItem[]> {
  const url = new URL("https://api.themoviedb.org/3/search/tv");
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  if (language) url.searchParams.set("language", language);
  if (region) url.searchParams.set("region", region);
  if (year) url.searchParams.set("first_air_date_year", String(year));

  const data = await fetchJSON<TMDBPaged<TMDBTVHit>>(
    url.toString(),
    HEADERS(token)
  );
  if (!data) return [];
  return (data.results ?? []).map((h) =>
    toResultItem({ ...h, media_type: "tv" })
  );
}
