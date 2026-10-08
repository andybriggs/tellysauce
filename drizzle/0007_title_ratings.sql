CREATE TABLE IF NOT EXISTS title_ratings (
  imdb_id text PRIMARY KEY,
  imdb_rating text,
  rt_rating text,
  fetched_at timestamptz NOT NULL DEFAULT NOW()
);
