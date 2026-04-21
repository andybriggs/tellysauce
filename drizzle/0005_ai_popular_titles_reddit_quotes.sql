ALTER TABLE "ai_popular_titles"
  ADD COLUMN IF NOT EXISTS "reddit_quotes" jsonb;
