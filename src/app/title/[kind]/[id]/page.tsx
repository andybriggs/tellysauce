import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import BackLink from "@/components/BackLink";
import PosterCard from "@/components/PosterCard";
import TitleHeader from "@/components/TitleHeader";
import MetaPills from "@/components/MetaPills";
import Overview from "@/components/Overview";
import ExternalLinks from "@/components/ExternalLinks";
import WatchlistButton from "@/components/WatchlistButton";
import WhereToWatch from "@/components/WhereToWatch";
import TagsList from "@/components/TagsList";
import TitleActions from "@/components/TitleActions";
import Container from "@/components/Container";
import RecommendTitles from "@/components/recommendations/RecommendTitles";
import TrailerWithPosterOverlay from "@/components/TrailerWithPosterOverlay";

export const revalidate = 3600;

export type MediaKind = "movie" | "tv";

export interface TitleDetails {
  id: number;
  title: string;
  original_title?: string;
  plot_overview?: string;
  type?: MediaKind;
  runtime_minutes?: number | null;
  year?: number;
  end_year?: number | null;
  release_date?: string;
  imdb_id?: string | null;
  tmdb_id?: number | null;
  tmdb_type?: MediaKind | null;
  genres?: number[];
  genre_names?: string[];
  critic_score?: number | null; // always null
  tmdb_vote_average?: number | null;
  tmdb_vote_count?: number | null;
  us_rating?: string | null;
  poster?: string | null;
  posterMedium?: string | null;
  posterLarge?: string | null;
  backdrop?: string | null;
  original_language?: string | null;
  network_names?: string[];
  trailerKey?: string | null;
}

export interface TitleSource {
  source_id: number;
  name: string;
  type: "sub" | "rent" | "buy" | "free" | "ads";
  region: string;
  icon: string; // required string
  ios_url?: string | null;
  android_url?: string | null;
  web_url?: string | null;
  format?: string | null;
  price?: number | null;
  seasons?: unknown;
  episodes?: unknown;
}

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
  logo_path?: string | null; // include logo_path from TMDB
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

const TMDB_HEADERS = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN ?? ""}`,
});

const tmdbProviderLogo = (path?: string | null): string =>
  path ? `https://image.tmdb.org/t/p/w45${path}` : "";

const tmdbImg = {
  posterMedium: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w342${p}` : null,
  posterLarge: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w500${p}` : null,
  poster: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w185${p}` : null,
  backdrop: (p?: string | null) =>
    p ? `https://image.tmdb.org/t/p/w1280${p}` : null,
};

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

async function fetchIMDbRating(imdbId: string): Promise<string | null> {
  const key = process.env.OMDB_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${key}`,
    { next: { revalidate } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.Response === "False") return null;
  return data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null;
}

async function fetchTitleDetails(
  kind: MediaKind,
  id: string
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

async function fetchTitleSources(
  kind: MediaKind,
  id: string,
  region = "GB"
): Promise<TitleSource[]> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) return [];

  const url = `https://api.themoviedb.org/3/${kind}/${encodeURIComponent(
    id
  )}/watch/providers`;

  const res = await fetch(url, {
    headers: TMDB_HEADERS(),
    next: { revalidate },
  });
  if (!res.ok) return [];

  const data: TMDBProvidersResponse = await res.json();
  const regional = data.results?.[region];
  if (!regional) return [];

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

  const link = regional.link ?? null;

  return buckets.flatMap(({ type, list }) =>
    (list ?? []).map((p) => ({
      source_id: p.provider_id,
      name: p.provider_name,
      icon: tmdbProviderLogo(p.logo_path),
      type,
      region,
      ios_url: null,
      android_url: null,
      web_url: link,
      format: null,
      price: null,
      seasons: undefined,
      episodes: undefined,
    }))
  );
}

type PageParams = { kind: MediaKind; id: string };
type PageProps = { params: Promise<PageParams> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, kind } = await params;
  const data = await fetchTitleDetails(kind, id);
  if (!data) return { title: "Title not found" };

  const pieces = [
    data.title,
    data.year
      ? `(${data.year}${data.end_year ? `–${data.end_year}` : ""})`
      : undefined,
  ].filter(Boolean) as string[];

  return {
    title: pieces.join(" "),
    description: data.plot_overview ?? undefined,
    openGraph: {
      title: pieces.join(" "),
      description: data.plot_overview ?? undefined,
      images: data.backdrop
        ? [data.backdrop]
        : data.posterLarge
        ? [data.posterLarge]
        : undefined,
    },
  };
}

export default async function TitlePage({ params }: PageProps) {
  const { id, kind } = await params;

  const [data, sources] = await Promise.all([
    fetchTitleDetails(kind, id),
    fetchTitleSources(kind, id, "GB"),
  ]);

  if (!data) notFound();

  const imdbRating = data.imdb_id
    ? await fetchIMDbRating(data.imdb_id)
    : null;

  const title = data.title || data.original_title || "Untitled";
  const poster =
    data.posterLarge || data.posterMedium || data.poster || undefined;
  const backdrop = data.backdrop || undefined;

  const titleToSave = {
    id: data.id,
    name: title,
    poster: poster ?? null,
    year: data.year,
    type: data.type,
    description: data.plot_overview ?? null,
  } as const;

  const seed = {
    title,
    overview: data.plot_overview ?? undefined,
    genres: data.genre_names ?? undefined,
    year: data.year ?? undefined,
    type: data.type ?? undefined,
    external: {
      tmdbId: data.tmdb_id ?? undefined,
      imdbId: data.imdb_id ?? undefined,
    },
  } as const;

  const recCacheKey = `cachedRecommendations:seed:${data.type}:${
    data.tmdb_id ?? data.id
  }`;

  return (
    <main className="relative min-h-[60vh] w-full pb-8">
      <Backdrop backdropUrl={backdrop} />

      <Container>
        <div className="col-span-full my-8">
          <BackLink href="/" label="Back" />
        </div>

        {/* Title — full-width block above the grid */}
        <div className="mb-6 space-y-3">
          <TitleHeader title={title} />
          {/* Ratings + watchlist/star actions in a line below the title */}
          <div className="flex flex-wrap items-center gap-3">
            <ExternalLinks
              imdbId={data.imdb_id ?? undefined}
              imdbRating={imdbRating}
              tmdbType={data.tmdb_type ?? undefined}
              tmdbId={data.tmdb_id ?? undefined}
              tmdbVoteAverage={data.tmdb_vote_average ?? undefined}
            />
            <WatchlistButton title={titleToSave} />
            <TitleActions title={titleToSave} />
          </div>
        </div>

        {/* Tablet: two columns (1:3). Desktop: three columns (1:3:1). Mobile: stacked. */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Column 1: Poster — hidden on mobile only when a trailer is available (poster overlaid on video instead) */}
          <aside className={`${data.trailerKey ? "hidden md:block" : ""} md:col-span-1 lg:col-span-1 mx-auto md:mx-0 w-full max-w-xs aspect-[2/3]`}>
            <PosterCard posterUrl={poster} title={title} />
          </aside>

          {/* Column 2: Trailer, or tags + description when no trailer available */}
          <div className="md:col-span-3 lg:col-span-3">
            {data.trailerKey ? (
              <TrailerWithPosterOverlay
                trailerKey={data.trailerKey}
                poster={poster}
                title={title}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <MetaPills
                    year={data.year}
                    endYear={data.end_year ?? undefined}
                    type={data.type}
                    usRating={data.us_rating ?? undefined}
                    language={data.original_language ?? undefined}
                  />
                  <TagsList
                    genres={data.genre_names}
                    networks={data.network_names}
                    showLabel={false}
                  />
                </div>
                <Overview text={data.plot_overview} />
              </div>
            )}
          </div>

          {/* Column 3: Providers — hidden on mobile (rendered below instead), stacked on md, side column on lg */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-1 lg:aspect-[2/3] lg:overflow-y-auto">
            <WhereToWatch sources={sources} />
          </aside>
        </div>

        {/* Meta pills + genre/network tags — only shown here when a trailer is present */}
        {data.trailerKey && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <MetaPills
              year={data.year}
              endYear={data.end_year ?? undefined}
              type={data.type}
              usRating={data.us_rating ?? undefined}
              language={data.original_language ?? undefined}
            />
            <TagsList
              genres={data.genre_names}
              networks={data.network_names}
              showLabel={false}
            />
          </div>
        )}

        {/* Description — only shown here when a trailer is present (otherwise rendered in the middle column) */}
        {data.trailerKey && (
          <div className="mt-4">
            <Overview text={data.plot_overview} />
          </div>
        )}

        {/* Where to watch — mobile only (hidden on md+, where it renders inside the grid) */}
        <div className="md:hidden mt-6">
          <WhereToWatch sources={sources} />
        </div>

        <div className="mt-8">
          <RecommendTitles
            seed={seed}
            cacheKey={recCacheKey}
            buttonLabel="More like this"
          />
        </div>
      </Container>
    </main>
  );
}
