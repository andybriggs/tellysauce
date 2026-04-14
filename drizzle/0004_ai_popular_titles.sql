CREATE TABLE IF NOT EXISTS "ai_popular_titles" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tmdb_id"       integer NOT NULL,
  "media_type"    media_type NOT NULL,
  "title"         text NOT NULL,
  "poster"        text,
  "year"          integer,
  "description"   text,
  "ai_reason"     text,
  "rank"          integer NOT NULL,
  "fetched_date"  date NOT NULL,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_popular_titles_type_date_idx
  ON "ai_popular_titles" ("media_type", "fetched_date" DESC);
