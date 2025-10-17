-- Unique on titles (tmdb_id, media_type) for ON CONFLICT in titles upsert
CREATE UNIQUE INDEX IF NOT EXISTS titles_tmdb_media_uidx
  ON "titles" ("tmdb_id", "media_type");

-- Unique on user_titles (user_id, title_id) for ON CONFLICT in rating/watchlist upserts
CREATE UNIQUE INDEX IF NOT EXISTS user_titles_user_title_uidx
  ON "user_titles" ("user_id", "title_id");

-- Optional but recommended business rule
DO $$
BEGIN
  ALTER TABLE "user_titles" ADD CONSTRAINT user_titles_status_rating_check
  CHECK (
    CASE
      WHEN "status" = 'WATCHLIST' THEN "rating" IS NULL
      WHEN "status" = 'RATED'     THEN "rating" BETWEEN 1 AND 5
      ELSE FALSE
    END
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
