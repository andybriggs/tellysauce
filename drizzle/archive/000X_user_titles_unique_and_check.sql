-- Unique one-row-per (user, title)
CREATE UNIQUE INDEX IF NOT EXISTS user_titles_user_title_uidx
ON "user_titles" ("user_id", "title_id");

-- Business rule: WATCHLIST => rating IS NULL, RATED => rating BETWEEN 1..5
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
