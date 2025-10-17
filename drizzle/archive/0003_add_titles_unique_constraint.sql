-- Add unique constraint on (tmdb_id, media_type)
-- (required for upsert in titleStore.ts)
ALTER TABLE "titles"
  ADD CONSTRAINT "titles_tmdb_media_unique"
  UNIQUE ("tmdb_id", "media_type");
