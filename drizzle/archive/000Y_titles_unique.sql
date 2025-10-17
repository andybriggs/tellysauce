CREATE UNIQUE INDEX IF NOT EXISTS titles_tmdb_media_uidx
ON "titles" ("tmdb_id", "media_type");
