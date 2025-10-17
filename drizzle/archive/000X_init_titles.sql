-- Ensure a title is unique per (tmdb_id, media_type)
ALTER TABLE "titles"
ADD CONSTRAINT "titles_tmdb_media_unique"
UNIQUE ("tmdb_id", "media_type");

-- Each user can have at most one row per title
ALTER TABLE "user_titles"
ADD CONSTRAINT "user_titles_user_title_unique"
UNIQUE ("user_id", "title_id");

-- Business rule: rated ⇒ rating 1..5; watchlist ⇒ rating NULL
ALTER TABLE "user_titles"
ADD CONSTRAINT "user_titles_status_rating_check"
CHECK (
  CASE
    WHEN "status" = 'WATCHLIST' THEN "rating" IS NULL
    WHEN "status" = 'RATED'     THEN "rating" BETWEEN 1 AND 5
    ELSE FALSE
  END
);

-- (Optional) helpful index for lookups by user
CREATE INDEX "user_titles_user_idx" ON "user_titles" ("user_id");
-- (Optional) helpful index for joining back to titles
CREATE INDEX "user_titles_title_idx" ON "user_titles" ("title_id");
