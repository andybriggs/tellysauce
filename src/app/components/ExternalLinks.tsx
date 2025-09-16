import Link from "next/link";

interface ExternalLinksProps {
  trailerUrl?: string;
  imdbId?: string | null;
  tmdbType?: string | null;
  tmdbId?: number | null;
}

export default function ExternalLinks({
  trailerUrl,
  imdbId,
  tmdbType,
  tmdbId,
}: ExternalLinksProps) {
  const hasAny = trailerUrl || imdbId || (tmdbId && tmdbType);
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {trailerUrl && (
        <Link
          href={trailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M4.5 5.653c0-1.426 1.537-2.33 2.78-1.61l11.54 6.347c1.296.712 1.296 2.508 0 3.22L7.28 19.957c-1.243.72-2.78-.185-2.78-1.61V5.653z" />
          </svg>
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
          IMDb
        </Link>
      )}

      {tmdbId && tmdbType && (
        <Link
          href={`https://www.themoviedb.org/${tmdbType}/${tmdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-green-500/20 px-4 py-2 text-green-100 ring-1 ring-green-400/30 transition hover:bg-green-500/30"
        >
          TMDB
        </Link>
      )}
    </div>
  );
}
