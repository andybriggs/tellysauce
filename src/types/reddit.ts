export type RedditQuote = {
  text: string;      // viewer quote from Reddit discussion
  subreddit: string; // subreddit name without "r/" prefix, e.g. "movies"
  url?: string;      // link to the Reddit thread where the quote was found
};
