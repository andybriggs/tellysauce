-- Make the conflict target unambiguous for ON CONFLICT ("user_id","title_id")
DO $$
BEGIN
  ALTER TABLE "user_titles"
    ADD CONSTRAINT "user_titles_user_title_unique"
    UNIQUE ("user_id", "title_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
