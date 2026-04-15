/**
 * One-off migration: adds subscription + free-call-counter columns to users.
 * Run with:  npx tsx src/db/migrate-subscription.ts
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

async function run() {
  console.log("Running subscription migration…");

  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS free_rec_calls_used   integer     NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
      ADD COLUMN IF NOT EXISTS subscription_status   text,
      ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz
  `;

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
