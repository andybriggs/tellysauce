import { NextResponse } from "next/server";

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
  type: MediaKind;
  year?: number;
  poster?: string | null;
  backdrop?: string | null;
  popularity?: number;
  score: number;
};

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  const kind = (searchParams.get("kind") as MediaKind | null) ?? null;
  const typesParam = (searchParams.get("types") || "movie,tv").toLowerCase();
  const yearParam = searchParams.get("year");
  const imdbId = searchParams.get("imdbId"); // e.g. tt0944947
  const language: Lang | undefined = searchParams.get("language") || undefined;
  const region: Region | undefined = searchParams.get("region") || undefined;

  const desc = (searchParams.get("desc") || "").trim();
  const tagsParam = (searchParams.get("tags") || "").trim();
  const minScore = Number(searchParams.get("minScore") || "85"); // tweakable gate

  if (!qRaw && !imdbId) {
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

  // If we have an IMDb id, resolve directly (exact match).
  if (imdbId && /^tt\d+$/i.test(imdbId)) {
    const found = await findByImdb(imdbId, token, language, region);
    if (found) {
      return NextResponse.json({
        id: found.id,
        kind: found.type,
        results: [found],
      });
    }
    // fall through to text search if /find returns nothing
  }

  const q = qRaw;
  const parsedYear =
    parseYearFromString(qRaw) ?? (yearParam ? Number(yearParam) : undefined);
  const keywords = buildKeywords(desc, tagsParam);

  let pool: ResolveResultItem[] = [];

  // Prefer typed endpoints if kind or year provided (they support year filters)
  if (kind === "movie" && allowMovie) {
    pool = await searchMovie(q, token, language, region, parsedYear);
  } else if (kind === "tv" && allowTV) {
    pool = await searchTV(q, token, language, region, parsedYear);
  } else if (parsedYear) {
    // run both typed searches to leverage year filters
    const [movies, tv] = await Promise.all([
      allowMovie
        ? searchMovie(q, token, language, region, parsedYear)
        : Promise.resolve<ResolveResultItem[]>([]),
      allowTV
        ? searchTV(q, token, language, region, parsedYear)
        : Promise.resolve<ResolveResultItem[]>([]),
    ]);
    pool = [...movies, ...tv];
  } else {
    // single multi search
    pool = await searchMulti(q, token, language, region);
  }

  // Score with title similarity + year + kind + keyword overlap against overview/title
  const ranked = pool
    .map((it) => ({
      ...it,
      score: scoreItem(it, q, parsedYear, kind, keywords),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const passes = best && best.score >= minScore ? best : undefined;

  return NextResponse.json({
    id: passes?.id ?? null,
    kind: passes?.type ?? null,
    results: ranked,
  });
}

/* ---------------- helpers ---------------- */

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYearFromString(s: string): number | undefined {
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}

function extractYear(date?: string): number | undefined {
  return date && date.length >= 4 ? Number(date.slice(0, 4)) : undefined;
}

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

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function buildKeywords(desc: string, tagsCsv: string): string[] {
  const tagTokens = tagsCsv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const descTokens = tokenize(desc);
  // De-dup while preserving order a bit
  const all = [...descTokens, ...tagTokens];
  return Array.from(new Set(all)).slice(0, 20); // cap so it doesn't dominate
}

function keywordOverlapScore(target: string, keywords: string[]): number {
  if (!keywords.length || !target) return 0;
  const textTokens = new Set(tokenize(target));
  let hits = 0;
  for (const k of keywords) if (textTokens.has(k)) hits++;
  // weight modestly; you can adjust multiplier
  return hits * 6;
}

function toResultItem(hit: TMDBMovieHit | TMDBTVHit): ResolveResultItem {
  const isMovie =
    (hit as TMDBMovieHit).title !== undefined || hit.media_type === "movie";
  const name = isMovie
    ? (hit as TMDBMovieHit).title ?? ""
    : (hit as TMDBTVHit).name ?? "";
  const date = isMovie
    ? (hit as TMDBMovieHit).release_date
    : (hit as TMDBTVHit).first_air_date;
  const year = extractYear(date);
  const posterPath = (hit as TMDBMovieHit | TMDBTVHit).poster_path ?? null;
  const backdropPath = (hit as TMDBMovieHit | TMDBTVHit).backdrop_path ?? null;
  const popularity = (hit as TMDBMovieHit | TMDBTVHit).popularity ?? 0;

  return {
    id: hit.id,
    name,
    type: isMovie ? "movie" : "tv",
    year,
    poster: IMG.poster(posterPath),
    backdrop: IMG.backdrop(backdropPath),
    popularity,
    score: 0,
  };
}

function scoreItem(
  item: ResolveResultItem,
  q: string,
  queryYear?: number,
  preferKind?: MediaKind | null,
  keywords?: string[]
): number {
  const nq = normTitle(q);
  const ni = normTitle(item.name);

  let s = 0;

  // Title similarity
  if (ni === nq) s += 100;
  else if (ni.startsWith(nq)) s += 60;
  else if (ni.includes(nq)) s += 40;

  // Year closeness
  if (queryYear && item.year) {
    const diff = Math.abs(queryYear - item.year);
    if (diff === 0) s += 35;
    else if (diff === 1) s += 20;
    else if (diff === 2) s += 10;
    else s -= diff;
  }

  // Kind preference
  if (preferKind && item.type === preferKind) s += 10;

  // Popularity to break ties (small)
  s += Math.min(10, (item.popularity ?? 0) / 50);

  // Keyword overlap against title (stronger) and overview (we don’t have overview in the item,
  // but we’ll approximate by using the title only here; see search functions below for overview scoring).
  if (keywords?.length) {
    s += keywordOverlapScore(item.name, keywords) * 1.2;
  }

  return s;
}

/* -------------- network calls -------------- */

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

  const r = await fetch(url.toString(), {
    headers: HEADERS(token),
    cache: "no-store",
  });
  if (!r.ok) return null;

  const data: TMDBFindResponse = await r.json();
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

  const r = await fetch(url.toString(), {
    headers: HEADERS(token),
    cache: "no-store",
  });
  if (!r.ok) return [];

  const data: TMDBPaged<TMDBMultiResult> = await r.json();
  const hits = (data.results ?? []).filter(
    (x): x is TMDBMovieHit | TMDBTVHit =>
      (x as TMDBPersonHit).media_type !== "person" &&
      ((x as TMDBMovieHit).title !== undefined ||
        (x as TMDBTVHit).name !== undefined)
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
  if (year) url.searchParams.set("year", String(year));

  const r = await fetch(url.toString(), {
    headers: HEADERS(token),
    cache: "no-store",
  });
  if (!r.ok) return [];
  const data: TMDBPaged<TMDBMovieHit> = await r.json();

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

  const r = await fetch(url.toString(), {
    headers: HEADERS(token),
    cache: "no-store",
  });
  if (!r.ok) return [];
  const data: TMDBPaged<TMDBTVHit> = await r.json();

  return (data.results ?? []).map((h) =>
    toResultItem({ ...h, media_type: "tv" })
  );
}
