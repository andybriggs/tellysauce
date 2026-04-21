import type { RedditQuote } from "@/types/reddit";

interface RedditQuotesProps {
  quotes: RedditQuote[];
  title: string;
}

export default function RedditQuotes({ quotes, title }: RedditQuotesProps) {
  if (!quotes.length) return null;

  return (
    <section aria-label="What people are saying">
      <h2 className="text-2xl font-bold text-white mb-4">
        What people are saying
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.map((q, i) => {
          const searchUrl = `https://www.reddit.com/r/${q.subreddit}/search/?q=${encodeURIComponent(title)}&sort=top&t=week`;
          return (
            <li
              key={i}
              className="relative rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 flex flex-col gap-3"
            >
              {/* Decorative quote mark */}
              <span
                className="absolute top-3 right-4 text-4xl leading-none text-white/10 font-serif select-none"
                aria-hidden
              >
                &ldquo;
              </span>

              {/* Quote body */}
              <blockquote className="text-slate-200 text-[15px] leading-relaxed pr-6">
                &ldquo;{q.text}&rdquo;
              </blockquote>

              {/* Attribution row */}
              <footer className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-white/10">
                <span className="rounded-full bg-orange-500/15 text-orange-300 px-2 py-0.5 text-xs font-medium ring-1 ring-orange-400/20 truncate">
                  r/{q.subreddit}
                </span>
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View discussions about ${title} on r/${q.subreddit}`}
                  className="shrink-0 text-slate-500 hover:text-white transition-colors text-xs underline underline-offset-2"
                >
                  View thread
                </a>
              </footer>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
