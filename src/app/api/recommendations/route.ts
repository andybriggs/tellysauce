import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { recommendationItems, recommendationSets } from "@/db/schema";

export const runtime = "nodejs";

// Ensure tables exist (matches the POST route's bootstrap so GET can run first safely)
const ensureTablesOnce = (async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recommendation_sets (
      id              text PRIMARY KEY,
      user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key             text NOT NULL,
      user_key        text NOT NULL UNIQUE,
      origin          text NOT NULL,
      source          text NOT NULL DEFAULT 'GEMINI',
      input_snapshot  jsonb NOT NULL,
      seed_media_type text,
      seed_tmdb_id    integer,
      seed_imdb_id    text,
      seed_title      text,
      cache_version   text NOT NULL DEFAULT '1',
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      expires_at      timestamptz,
      is_stale        boolean NOT NULL DEFAULT false
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recommendation_items (
      id                   text PRIMARY KEY,
      set_id               text NOT NULL REFERENCES recommendation_sets(id) ON DELETE CASCADE,
      rank                 integer NOT NULL,
      title                text NOT NULL,
      description          text,
      reason               text,
      tags                 text[],
      suggested_media_type text,
      suggested_tmdb_id    integer,
      suggested_imdb_id    text,
      raw_json             jsonb NOT NULL,
      created_at           timestamptz NOT NULL DEFAULT now(),
      updated_at           timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'recommendation_items_set_rank_idx'
      ) THEN
        CREATE INDEX recommendation_items_set_rank_idx ON recommendation_items (set_id, rank);
      END IF;
    END
    $$;
  `);
})();

export async function GET(req: NextRequest) {
  await ensureTablesOnce;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) {
    return Response.json({ error: "Missing key" }, { status: 400 });
  }

  const userKey = `${session.user.id}:${key}`;

  const [setRow] = await db
    .select()
    .from(recommendationSets)
    .where(eq(recommendationSets.userKey, userKey))
    .limit(1);

  if (!setRow) {
    return Response.json({ set: null, items: [] }, { status: 200 });
  }

  // Helper to derive a year if not present in JSON
  const extractYear = (s?: string | null) => {
    if (!s) return null;
    const m = s.match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : null;
  };

  // Select items and project year from raw_json ("year": number|null) -> integer
  const rows = await db
    .select({
      id: recommendationItems.id,
      setId: recommendationItems.setId,
      rank: recommendationItems.rank,
      title: recommendationItems.title,
      description: recommendationItems.description,
      reason: recommendationItems.reason,
      tags: recommendationItems.tags,
      suggestedMediaType: recommendationItems.suggestedMediaType,
      suggestedTmdbId: recommendationItems.suggestedTmdbId,
      suggestedImdbId: recommendationItems.suggestedImdbId,
      rawJson: recommendationItems.rawJson,
      createdAt: recommendationItems.createdAt,
      updatedAt: recommendationItems.updatedAt,
      // pull year out of raw_json; cast to int; returns null if absent
      year: sql<
        number | null
      >`(${recommendationItems.rawJson} ->> 'year')::int`,
    })
    .from(recommendationItems)
    .where(eq(recommendationItems.setId, setRow.id))
    .orderBy(recommendationItems.rank);

  // Add a light fallback: if year is null, try to parse from title/tags/description
  const items = rows.map((r) => {
    const year =
      (typeof r.year === "number" && Number.isFinite(r.year) ? r.year : null) ??
      extractYear(r.title) ??
      extractYear((r.tags ?? []).join(" ")) ??
      extractYear(r.description);

    return {
      ...r,
      year,
    };
  });

  return Response.json({ set: setRow, items }, { status: 200 });
}
