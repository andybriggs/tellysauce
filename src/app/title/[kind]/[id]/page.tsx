// app/title/[kind]/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Backdrop from "@/app/components/Backdrop";
import BackLink from "@/app/components/BackLink";
import PosterCard from "@/app/components/PosterCard";
import TitleHeader from "@/app/components/TitleHeader";
import MetaPills from "@/app/components/MetaPills";
import Overview from "@/app/components/Overview";
import ExternalLinks from "@/app/components/ExternalLinks";
import WhereToWatch from "@/app/components/WhereToWatch";
import TagsList from "@/app/components/TagsList";
import TitleActions from "@/app/components/TitleActions";

export const revalidate = 3600;

// ----- Local types -----
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
  us_rating?: string | null;
  poster?: string | null;
  posterMedium?: string | null;
  posterLarge?: string | null;
  backdrop?: string | null;
  original_language?: string | null;
  network_names?: string[];
  trailer?: string | null;
}

export interface TitleSource {
  source_id: number;
  name: string;
  type: "sub" | "rent" | "buy" | "free" | "ads";
  region: string;
  ios_url?: string | null;
  android_url?: string | null;
  web_url?: string | null;
  format?: string | null;
  price?: number | null;
  seasons?: unknown;
  episodes?: unknown;
}

// ----- Minimal TMDB types we use -----
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

type TMDBProvidersResponse = {
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: Array<{ provider_id: number; provider_name: string }>;
      rent?: Array<{ provider_id: number; provider_name: string }>;
      buy?: Array<{ provider_id: number; provider_name: string }>;
      free?: Array<{ provider_id: number; provider_name: string }>;
      ads?: Array<{ provider_id: number; provider_name: string }>;
    }
  >;
};

// ----- helpers -----
const TMDB_HEADERS = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN ?? ""}`,
});

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
  return pick?.key ? `https://www.youtube.com/watch?v=${pick.key}` : null;
}

// ----- mapping -----
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
    genres: (m.genres ?? []).map((g) => g.id),
    genre_names: (m.genres ?? []).map((g) => g.name),
    poster: tmdbImg.poster(m.poster_path),
    posterMedium: tmdbImg.posterMedium(m.poster_path),
    posterLarge: tmdbImg.posterLarge(m.poster_path),
    backdrop: tmdbImg.backdrop(m.backdrop_path),
    original_language: m.original_language ?? null,
    network_names: undefined,
    trailer: extractTrailer(m.videos),
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
    genres: (tv.genres ?? []).map((g) => g.id),
    genre_names: (tv.genres ?? []).map((g) => g.name),
    poster: tmdbImg.poster(tv.poster_path),
    posterMedium: tmdbImg.posterMedium(tv.poster_path),
    posterLarge: tmdbImg.posterLarge(tv.poster_path),
    backdrop: tmdbImg.backdrop(tv.backdrop_path),
    original_language: tv.original_language ?? null,
    network_names: (tv.networks ?? []).map((n) => n.name),
    trailer: extractTrailer(tv.videos),
  };
}

// ----- fetchers (make these file-local; do NOT export) -----
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
    list?: Array<{ provider_id: number; provider_name: string }>;
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
      type,
      region,
      ios_url: null,
      android_url: null,
      web_url: link, // TMDB gives a region deeplink
      format: null,
      price: null,
      seasons: undefined,
      episodes: undefined,
    }))
  );
}

// ----- Next.js page -----
type PageParams = { kind: MediaKind; id: string };
type PageProps = { params: Promise<PageParams> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, kind } = await params; // <- await
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
  const { id, kind } = await params; // <- await

  const [data, sources] = await Promise.all([
    fetchTitleDetails(kind, id),
    fetchTitleSources(kind, id, "GB"),
  ]);

  if (!data) notFound();

  const title = data.title || data.original_title || "Untitled";
  const poster =
    data.posterLarge || data.posterMedium || data.poster || undefined;
  const backdrop = data.backdrop || undefined;

  const showToSave = {
    id: data.id,
    name: title,
    poster: poster ?? null,
    year: data.year,
    type: data.type,
    description: data.plot_overview ?? null,
  } as const;

  return (
    <main className="relative min-h-[60vh] w-full">
      <Backdrop backdropUrl={backdrop} />

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-[220px,1fr] md:py-14 lg:grid-cols-[260px,1fr]">
        <div className="col-span-full">
          <BackLink href="/" label="Back" />
        </div>

        <PosterCard posterUrl={poster} title={title} />

        <div className="space-y-6">
          <div className="space-y-3">
            <TitleHeader
              title={title}
              actionSlot={<TitleActions show={showToSave} />}
            />
            <MetaPills
              year={data.year}
              endYear={data.end_year ?? undefined}
              type={data.type}
              usRating={data.us_rating ?? undefined}
              language={data.original_language ?? undefined}
            />
          </div>

          <Overview text={data.plot_overview} />
          <TagsList genres={data.genre_names} networks={data.network_names} />
          <ExternalLinks
            trailerUrl={data.trailer ?? undefined}
            imdbId={data.imdb_id ?? undefined}
            tmdbType={data.tmdb_type ?? undefined}
            tmdbId={data.tmdb_id ?? undefined}
          />
        </div>
      </section>

      <WhereToWatch sources={sources} regionLabel="GB" />
    </main>
  );
}
