const TMDB_BASE = "https://api.themoviedb.org/3";

type MediaType = "tv" | "movie";
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

/** Build URL + headers for TMDB using either v4 token or v3 api key. */
function tmdbRequest(endpoint: string) {
  const v4 = process.env.TMDB_ACCESS_TOKEN; // ← your existing token (preferred)
  const v3 = process.env.TMDB_API_KEY; // ← optional fallback

  if (!v4 && !v3) {
    throw new Error(
      "Missing TMDB credentials. Set TMDB_ACCESS_TOKEN (v4) or TMDB_API_KEY (v3) in env."
    );
  }

  if (v4) {
    // v4 Bearer token (recommended)
    return {
      url: `${TMDB_BASE}/${endpoint}?language=en-US`,
      headers: {
        Authorization: `Bearer ${v4}`,
        Accept: "application/json",
      } as Record<string, string>,
    };
  }

  // v3 api_key in query string
  return {
    url: `${TMDB_BASE}/${endpoint}?language=en-US&api_key=${encodeURIComponent(
      v3!
    )}`,
    headers: { Accept: "application/json" } as Record<string, string>,
  };
}

/** Fetch minimal title data from TMDB (works for tv or movie). */
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
