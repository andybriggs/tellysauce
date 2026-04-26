import Link from "next/link";
import Image from "next/image";

interface ExternalLinksProps {
  imdbId?: string | null;
  imdbRating?: string | null;
  rtRating?: string | null;
  rtSearchTitle?: string;
}

export default function ExternalLinks({
  imdbId,
  imdbRating,
  rtRating,
  rtSearchTitle,
}: ExternalLinksProps) {
  if (!imdbId && !rtRating) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {imdbId && (
        <Link
          href={`https://www.imdb.com/title/${imdbId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500/20 px-4 py-2 text-yellow-100 ring-1 ring-yellow-400/30 transition hover:bg-yellow-500/30"
          title="View on IMDb"
        >
          <Image src="/imdb.png" alt="IMDb" width={24} height={12} className="rounded-sm" />
          {imdbRating ? (
            <span className="font-semibold">★ {imdbRating}</span>
          ) : (
            <span className="text-sm opacity-60">Rating unavailable</span>
          )}
        </Link>
      )}

      {rtRating && (
        <Link
          href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(rtSearchTitle ?? "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2 text-red-100 ring-1 ring-red-400/30 transition hover:bg-red-500/30"
          title="View on Rotten Tomatoes"
        >
          <Image src="/rt-logo.svg" alt="Rotten Tomatoes" width={20} height={20} />
          <span className="font-semibold">{rtRating}</span>
        </Link>
      )}
    </div>
  );
}
