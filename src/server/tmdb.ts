import type { TitleDetails, TitleSource, MediaType } from "@/types/title";

export const TMDB_BASE = "https://api.themoviedb.org/3";

// ---------------------------------------------------------------------------
// Auth / request helpers
// ---------------------------------------------------------------------------

export function TMDB_HEADERS(): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN ?? ""}`,
  };
}

export const tmdbImg = {
  poster: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w185${p}` : null,
  posterMedium: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w342${p}` : null,
  posterLarge: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w500${p}` : null,
  backdrop: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w1280${p}` : null,
};

export const tmdbProviderLogo = (path?: string | null): string =>
  path ? `https://image.tmdb.org/t/p/w45${path}` : "";

// ---------------------------------------------------------------------------
// Private TMDB response shape types
// ---------------------------------------------------------------------------

type TMDBGenre = { id: number; name: string };
type TMDBNetwork = { id: number; name: string };

type TMDBVideo = {
  key: string;
  site: "YouTube" | "Vimeo" | string;
  type: "Trailer" | "Teaser" | string;
  official?: boolean;
};

type TMDBExternalIds = { imdb_id: string | null };

type TMDBReleaseDates = {
  release_dates?: {
    results?: Array<{
      iso_3166_1: string;
      release_dates?: Array<{ certification?: string }>;
    }>;
  };
};

type TMDBContentRatings = {
  content_ratings?: {
    results?: Array<{
      iso_3166_1: string;
      rating?: string;
    }>;
  };
};

type TMDBCommon = {
  id: number;
  overview?: string;
  genres?: TMDBGenre[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  original_language?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  videos?: { results?: TMDBVideo[] };
  images?: unknown;
  external_ids?: TMDBExternalIds;
};

type TMDBMovie = TMDBCommon &
  TMDBReleaseDates & {
    title?: string;
    original_title?: string;
    release_date?: string;
    runtime?: number | null;
  };

type TMDBTV = TMDBCommon &
  TMDBContentRatings & {
    name?: string;
    original_name?: string;
    first_air_date?: string;
    last_air_date?: string | null;
    episode_run_time?: number[];
    networks?: TMDBNetwork[];
  };

type TMDBProviderItem = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

type TMDBProviderGroup = {
  link?: string;
  flatrate?: TMDBProviderItem[];
  rent?: TMDBProviderItem[];
  buy?: TMDBProviderItem[];
  free?: TMDBProviderItem[];
  ads?: TMDBProviderItem[];
};

type TMDBProvidersResponse = {
  results?: Record<string, TMDBProviderGroup>;
};

// ---------------------------------------------------------------------------
// Mapper helpers
// ---------------------------------------------------------------------------

function extractTrailer(videos?: { results?: TMDBVideo[] }): string | null {
  const list = videos?.results ?? [];
  const pick =
    list.find(
      (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
    ) ||
    list.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    null;
  return pick?.key ?? null;
}

function mapMovie(m: TMDBMovie): TitleDetails {
  const year = m.release_date ? Number(m.release_date.slice(0, 4)) : undefined;
  return {
    id: m.id,
    title: m.title ?? "Untitled",
    original_title: m.original_title ?? undefined,
    plot_overview: m.overview ?? undefined,
    type: "movie",
    runtime_minutes: m.runtime ?? null,
    year,
    end_year: null,
    release_date: m.release_date ?? undefined,
    imdb_id: m.external_ids?.imdb_id ?? null,
    tmdb_id: m.id,
    tmdb_type: "movie",
    tmdb_vote_average: m.vote_average ?? null,
    tmdb_vote_count: m.vote_count ?? null,
    genres: (m.genres ?? []).map((g) => g.id),
    genre_names: (m.genres ?? []).map((g) => g.name),
    poster: tmdbImg.poster(m.poster_path),
    posterMedium: tmdbImg.posterMedium(m.poster_path),
    posterLarge: tmdbImg.posterLarge(m.poster_path),
    backdrop: tmdbImg.backdrop(m.backdrop_path),
    original_language: m.original_language ?? null,
    network_names: undefined,
    trailerKey: extractTrailer(m.videos),
  };
}

function mapTV(tv: TMDBTV): TitleDetails {
  const year = tv.first_air_date
    ? Number(tv.first_air_date.slice(0, 4))
    : undefined;
  const endYear = tv.last_air_date
    ? Number(tv.last_air_date.slice(0, 4))
    : null;
  return {
    id: tv.id,
    title: tv.name ?? "Untitled",
    original_title: tv.original_name ?? undefined,
    plot_overview: tv.overview ?? undefined,
    type: "tv",
    runtime_minutes:
      Array.isArray(tv.episode_run_time) && tv.episode_run_time.length
        ? tv.episode_run_time[0]
        : null,
    year,
    end_year: endYear,
    release_date: tv.first_air_date ?? undefined,
    imdb_id: tv.external_ids?.imdb_id ?? null,
    tmdb_id: tv.id,
    tmdb_type: "tv",
    tmdb_vote_average: tv.vote_average ?? null,
    tmdb_vote_count: tv.vote_count ?? null,
    genres: (tv.genres ?? []).map((g) => g.id),
    genre_names: (tv.genres ?? []).map((g) => g.name),
    poster: tmdbImg.poster(tv.poster_path),
    posterMedium: tmdbImg.posterMedium(tv.poster_path),
    posterLarge: tmdbImg.posterLarge(tv.poster_path),
    backdrop: tmdbImg.backdrop(tv.backdrop_path),
    original_language: tv.original_language ?? null,
    network_names: (tv.networks ?? []).map((n) => n.name),
    trailerKey: extractTrailer(tv.videos),
  };
}

// ---------------------------------------------------------------------------
// Public fetch functions — title detail page
// ---------------------------------------------------------------------------

export async function fetchTitleDetails(
  kind: MediaType,
  id: string,
  revalidate: number
): Promise<TitleDetails | null> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) return null;

  const append = "videos,images,external_ids,release_dates,content_ratings";
  const url = `https://api.themoviedb.org/3/${kind}/${encodeURIComponent(
    id
  )}?append_to_response=${encodeURIComponent(append)}`;

  const res = await fetch(url, {
    headers: TMDB_HEADERS(),
    next: { revalidate },
  });
  if (!res.ok) return null;

  if (kind === "movie") {
    const data: TMDBMovie = await res.json();
    return mapMovie(data);
  } else {
    const data: TMDBTV = await res.json();
    return mapTV(data);
  }
}

export async function fetchTitleSources(
  kind: MediaType,
  id: string,
  revalidate: number
): Promise<Record<string, TitleSource[]>> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) return {};

  const url = `https://api.themoviedb.org/3/${kind}/${encodeURIComponent(
    id
  )}/watch/providers`;

  const res = await fetch(url, {
    headers: TMDB_HEADERS(),
    next: { revalidate },
  });
  if (!res.ok) return {};

  const data: TMDBProvidersResponse = await res.json();
  if (!data.results) return {};

  const out: Record<string, TitleSource[]> = {};
  for (const [regionCode, regional] of Object.entries(data.results)) {
    const link = regional.link ?? null;
    const buckets: Array<{
      type: TitleSource["type"];
      list?: TMDBProviderItem[];
    }> = [
      { type: "sub", list: regional.flatrate },
      { type: "rent", list: regional.rent },
      { type: "buy", list: regional.buy },
      { type: "free", list: regional.free },
      { type: "ads", list: regional.ads },
    ];
    const sources = buckets.flatMap(({ type, list }) =>
      (list ?? []).map((p) => ({
        source_id: p.provider_id,
        name: p.provider_name,
        icon: tmdbProviderLogo(p.logo_path),
        type,
        region: regionCode,
        ios_url: null,
        android_url: null,
        web_url: link,
        format: null,
        price: null,
      }))
    );
    if (sources.length) out[regionCode] = sources;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public fetch function — basic title info (used by cron / titleStore)
// ---------------------------------------------------------------------------

export type TMDBTitle = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  year: number | null;
  description: string | null;
};

function yearFrom(dateStr?: string | null) {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function tmdbRequest(endpoint: string) {
  const v4 = process.env.TMDB_ACCESS_TOKEN;
  const v3 = process.env.TMDB_API_KEY;

  if (!v4 && !v3) {
    throw new Error(
      "Missing TMDB credentials. Set TMDB_ACCESS_TOKEN (v4) or TMDB_API_KEY (v3) in env."
    );
  }

  if (v4) {
    return {
      url: `${TMDB_BASE}/${endpoint}?language=en-US`,
      headers: {
        Authorization: `Bearer ${v4}`,
        Accept: "application/json",
      } as Record<string, string>,
    };
  }

  return {
    url: `${TMDB_BASE}/${endpoint}?language=en-US&api_key=${encodeURIComponent(
      v3!
    )}`,
    headers: { Accept: "application/json" } as Record<string, string>,
  };
}

export async function fetchTMDBTitle(
  tmdbId: number,
  mediaType: MediaType
): Promise<TMDBTitle | null> {
  const path = mediaType === "tv" ? `tv/${tmdbId}` : `movie/${tmdbId}`;
  const { url, headers } = tmdbRequest(path);

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `TMDB fetch failed: ${res.status} ${res.statusText} ${text}`.trim()
    );
  }

  const json = await res.json();
  const title = mediaType === "tv" ? json.name : json.title;
  const posterPath: string | null = json.poster_path ?? null;
  const release = mediaType === "tv" ? json.first_air_date : json.release_date;

  return {
    tmdbId,
    mediaType,
    title: title ?? "",
    poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
    year: yearFrom(release ?? null),
    description: json.overview ?? null,
  };
}
