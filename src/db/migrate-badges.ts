/**
 * One-off migration: adds the user_badges table and users.lifetime_rec_calls.
 * Mirrors drizzle/0006_user_badges.sql.
 * Run with:  npx tsx src/db/migrate-badges.ts
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

async function run() {
  console.log("Running badges migration…");

  await sql`
    CREATE TABLE IF NOT EXISTS "user_badges" (
      "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "badge_key"  text NOT NULL,
      "seen"       boolean NOT NULL DEFAULT false,
      "awarded_at" timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    DO $$
    BEGIN
      ALTER TABLE "user_badges"
        ADD CONSTRAINT "user_badges_user_key_unique" UNIQUE ("user_id", "badge_key");
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "user_badges_user_idx" ON "user_badges" ("user_id")
  `;

  await sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "lifetime_rec_calls" integer NOT NULL DEFAULT 0
  `;

  await sql`
    UPDATE "users"
       SET "lifetime_rec_calls" = COALESCE("free_rec_calls_used", 0)
                                + COALESCE("pro_rec_calls_this_period", 0)
     WHERE "lifetime_rec_calls" = 0
  `;

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'user_badges' ORDER BY ordinal_position
  `;
  console.log("user_badges columns:", cols.map((c) => c.column_name).join(", "));
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
