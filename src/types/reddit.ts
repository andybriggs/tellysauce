export type RedditQuote = {
  text: string;      // paraphrased sentiment from Reddit discussion
  subreddit: string; // subreddit name without "r/" prefix, e.g. "movies"
};
