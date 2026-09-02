-- Gamification badges. One row per (user, badge) award; awards are permanent.
CREATE TABLE IF NOT EXISTS "user_badges" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "badge_key"  text NOT NULL,
  "seen"       boolean NOT NULL DEFAULT false,
  "awarded_at" timestamptz NOT NULL DEFAULT now()
);

-- Named constraint is the ON CONFLICT target used by awardBadges()
DO $$
BEGIN
  ALTER TABLE "user_badges"
    ADD CONSTRAINT "user_badges_user_key_unique" UNIQUE ("user_id", "badge_key");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Lookup index for GET /api/badges
CREATE INDEX IF NOT EXISTS "user_badges_user_idx" ON "user_badges" ("user_id");

-- Lifetime AI-rec counter. pro_rec_calls_this_period resets every billing cycle
-- and free_rec_calls_used caps at 3, so neither can drive a lifetime milestone.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lifetime_rec_calls" integer NOT NULL DEFAULT 0;

-- Approximate backfill for existing users.
UPDATE "users"
   SET "lifetime_rec_calls" = COALESCE("free_rec_calls_used", 0)
                            + COALESCE("pro_rec_calls_this_period", 0)
 WHERE "lifetime_rec_calls" = 0;
