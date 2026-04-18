import { PlayCircleIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

interface ExternalLinksProps {
  trailerUrl?: string;
  imdbId?: string | null;
  imdbRating?: string | null;
  tmdbType?: string | null;
  tmdbId?: number | null;
  tmdbVoteAverage?: number | null;
}

export default function ExternalLinks({
  trailerUrl,
  imdbId,
  imdbRating,
  tmdbType,
  tmdbId,
  tmdbVoteAverage,
}: ExternalLinksProps) {
  const hasAny = trailerUrl || imdbId || (tmdbId && tmdbType);
  if (!hasAny) return null;

  const tmdbScore =
    tmdbVoteAverage != null && tmdbVoteAverage > 0
      ? tmdbVoteAverage.toFixed(1)
      : null;

  return (
    <div className="flex flex-wrap gap-3">
      {trailerUrl && (
        <Link
          href={trailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <PlayCircleIcon className="h-6 w-6" />
          Watch trailer
        </Link>
      )}

      {imdbId && (
        <Link
          href={`https://www.imdb.com/title/${imdbId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500/20 px-4 py-2 text-yellow-100 ring-1 ring-yellow-400/30 transition hover:bg-yellow-500/30"
        >
          <span>IMDb</span>
          {imdbRating ? (
            <span className="font-semibold">★ {imdbRating}</span>
          ) : (
            <span className="text-sm opacity-60">Rating unavailable</span>
          )}
        </Link>
      )}

      {tmdbId && tmdbType && (
        <Link
          href={`https://www.themoviedb.org/${tmdbType}/${tmdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-green-500/20 px-4 py-2 text-green-100 ring-1 ring-green-400/30 transition hover:bg-green-500/30"
        >
          <span>TMDB</span>
          {tmdbScore ? (
            <span className="font-semibold">★ {tmdbScore}</span>
          ) : (
            <span className="text-sm opacity-60">Rating unavailable</span>
          )}
        </Link>
      )}
    </div>
  );
}
