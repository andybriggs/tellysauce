DO $$
BEGIN
  ALTER TABLE "titles"
    ADD CONSTRAINT "titles_tmdb_media_unique"
    UNIQUE ("tmdb_id", "media_type");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
