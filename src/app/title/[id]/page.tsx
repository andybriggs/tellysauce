// app/title/[id]/page.tsx
import Backdrop from "@/app/components/Backdrop";
import BackLink from "@/app/components/BackLink";
import PosterCard from "@/app/components/PosterCard";
import TitleHeader from "@/app/components/TitleHeader";
import MetaPills from "@/app/components/MetaPills";
import Overview from "@/app/components/Overview";
import ExternalLinks from "@/app/components/ExternalLinks";
import WhereToWatch from "@/app/components/WhereToWatch";
import TagsList from "@/app/components/TagsList";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TitleActions from "@/app/components/TitleActions";

export const revalidate = 3600;

export interface TitleDetails {
  id: number;
  title: string;
  original_title?: string;
  plot_overview?: string;
  type?: string;
  runtime_minutes?: number | null;
  year?: number;
  end_year?: number | null;
  release_date?: string;
  imdb_id?: string | null;
  tmdb_id?: number | null;
  tmdb_type?: string | null;
  genres?: number[];
  genre_names?: string[];
  user_rating?: number | null;
  critic_score?: number | null;
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
  type: string; // 'sub' | 'rent' | 'buy' | 'free' | etc
  region: string; // e.g. 'GB'
  ios_url?: string | null;
  android_url?: string | null;
  web_url?: string | null;
  format?: string | null;
  price?: number | null;
  seasons?: unknown;
  episodes?: unknown;
}

async function fetchTitleDetails(id: string): Promise<TitleDetails | null> {
  const apiKey = process.env.WATCHMODE_API_KEY;
  if (!apiKey) {
    console.warn("WATCHMODE_API_KEY is not set in environment");
  }

  const url = `https://api.watchmode.com/v1/title/${encodeURIComponent(
    id
  )}/details/?apiKey=${apiKey ?? ""}`;

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return null;
  const data = (await res.json()) as TitleDetails;
  if (!data || !data.id) return null;
  return data;
}

async function fetchTitleSources(
  id: string,
  regions = "GB"
): Promise<TitleSource[]> {
  const apiKey = process.env.WATCHMODE_API_KEY;
  const url = `https://api.watchmode.com/v1/title/${encodeURIComponent(
    id
  )}/sources/?apiKey=${apiKey ?? ""}${regions ? `&regions=${regions}` : ""}`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as TitleSource[]) : [];
}

// Next.js 15: params is a Promise
type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params; // await the promise
  const data = await fetchTitleDetails(id);
  if (!data) return { title: "Title not found" };

  const pieces = [
    data.title,
    data.year
      ? `(${data.year}${data.end_year ? `–${data.end_year}` : ""})`
      : undefined,
  ].filter(Boolean);

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
  const { id } = await params; // await the promise

  const [data, sources] = await Promise.all([
    fetchTitleDetails(id),
    fetchTitleSources(id, "GB"),
  ]);
  if (!data) notFound();

  const title = data.title || data.original_title || "Untitled";
  const poster =
    data.posterLarge || data.posterMedium || data.poster || undefined;
  const backdrop = data.backdrop || undefined;

  const showToSave = {
    id: data.id,
    name: title,
    image: poster ?? null,
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
