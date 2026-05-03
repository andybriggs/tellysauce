import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Backdrop from "@/components/layout/Backdrop";
import BackLink from "@/components/layout/BackLink";
import PosterCard from "@/components/title/PosterCard";
import TitleHeader from "@/components/title/TitleHeader";
import MetaPills from "@/components/title/MetaPills";
import Overview from "@/components/title/Overview";
import ExternalLinks from "@/components/title/ExternalLinks";
import WatchlistButton from "@/components/watchlist/WatchlistButton";
import WhereToWatch from "@/components/title/WhereToWatch";
import TagsList from "@/components/title/TagsList";
import TitleActions from "@/components/title/TitleActions";
import Container from "@/components/common/Container";
import RecommendationsSection from "@/components/recommendations/RecommendationsSection";
import TrailerWithPosterOverlay from "@/components/title/TrailerWithPosterOverlay";
import { fetchTitleDetails, fetchTitleSources } from "@/server/tmdb";
import { fetchIMDbRating } from "@/server/omdb";
import { fetchAiPopularData } from "@/server/aiPopular";
import type { MediaType } from "@/types/title";

export const revalidate = 3600;

// Re-export for any consumers that previously imported MediaKind from here
export type { MediaType };

type PageParams = { kind: MediaType; id: string };
type PageProps = { params: Promise<PageParams> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, kind } = await params;
  const data = await fetchTitleDetails(kind, id, revalidate);
  if (!data) return { title: "Title not found" };

  const pieces = [
    data.title,
    data.year
      ? `(${data.year}${data.end_year ? `-${data.end_year}` : ""})`
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

  const [data, allSources, aiPopularData] = await Promise.all([
    fetchTitleDetails(kind, id, revalidate),
    fetchTitleSources(kind, id, revalidate),
    fetchAiPopularData(Number(id), kind),
  ]);

  if (!data) notFound();

  const { imdbRating, rtRating } = data.imdb_id
    ? await fetchIMDbRating(data.imdb_id, revalidate)
    : { imdbRating: null, rtRating: null };

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

  // Shared JSX blocks - avoids duplicating the same elements
  // for the "trailer present" vs "no trailer" layout variants.
  const metaSection = (
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
  );

  const whereToWatch = <WhereToWatch allSources={allSources} />;

  return (
    <main className="relative min-h-[60vh] w-full pb-8">
      <Backdrop backdropUrl={backdrop} />

      <Container>
        <div className="col-span-full my-8">
          <BackLink label="Back" />
        </div>

        {/* Title - full-width block above the grid */}
        <div className="mb-6 space-y-3">
          <TitleHeader title={title} />
          {/* Ratings + watchlist/star actions in a line below the title */}
          <div className="flex flex-wrap items-center gap-3">
            <ExternalLinks
              imdbId={data.imdb_id ?? undefined}
              imdbRating={imdbRating}
              rtRating={rtRating}
              rtSearchTitle={title}
            />
            <WatchlistButton title={titleToSave} />
            <TitleActions title={titleToSave} />
          </div>
        </div>

        {/* Tablet: two columns (1:3). Desktop: three columns (1:3:1). Mobile: stacked. */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Column 1: Poster - hidden on mobile only when a trailer is available (poster overlaid on video instead) */}
          <aside className={`${data.trailerKey ? "hidden md:block" : ""} md:col-span-1 lg:col-span-1 mx-auto md:mx-0 w-full max-w-xs aspect-[2/3]`}>
            <PosterCard posterUrl={poster} title={title} />
          </aside>

          {/* Column 2: Trailer when available, otherwise meta + overview fills the space */}
          <div className="md:col-span-3 lg:col-span-3">
            {data.trailerKey ? (
              <TrailerWithPosterOverlay
                trailerKey={data.trailerKey}
                poster={poster}
                title={title}
              />
            ) : (
              metaSection
            )}
          </div>

          {/* Meta - shown inside the grid at mobile + md when trailer is present so it sits
              above the providers row. Hidden at lg where it renders after the grid instead. */}
          {data.trailerKey && (
            <div className="md:col-span-4 lg:hidden">{metaSection}</div>
          )}

          {/* Column 3: Providers - hidden on mobile (rendered below instead), stacked on md, side column on lg */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-1 lg:aspect-[2/3] lg:overflow-y-auto">
            {whereToWatch}
          </aside>
        </div>

        {/* Meta pills + genre/network tags + overview - only shown at lg+ when a trailer is present
            (at smaller sizes it renders inside the grid above, before the providers row) */}
        {data.trailerKey && (
          <div className="hidden lg:block mt-6">{metaSection}</div>
        )}

        {/* Where to watch - mobile only (hidden on md+, where it renders inside the grid) */}
        <div className="md:hidden mt-6">{whereToWatch}</div>

        <div className="mt-8">
          <RecommendationsSection
            seed={seed}
            buttonLabel="More like this"
          />
        </div>

        {aiPopularData?.aiReason && (
          <div className="mt-8">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-5 py-4 flex items-start gap-3">
              <span className="mt-0.5 text-orange-400" aria-hidden>&#9650;</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-1">Trending now</p>
                <p className="text-slate-200 text-sm leading-relaxed">{aiPopularData.aiReason}</p>
              </div>
            </div>
          </div>
        )}
      </Container>
    </main>
  );
}
