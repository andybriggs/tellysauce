import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { recommendationItems, recommendationSets, titles } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {

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

  // Select items, join with titles to get poster, project year from raw_json
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
      poster: titles.poster,
      rawJson: recommendationItems.rawJson,
      createdAt: recommendationItems.createdAt,
      updatedAt: recommendationItems.updatedAt,
      // pull year out of raw_json; cast to int; returns null if absent
      year: sql<number | null>`(${recommendationItems.rawJson} ->> 'year')::int`,
    })
    .from(recommendationItems)
    .leftJoin(
      titles,
      sql`${titles.tmdbId} = ${recommendationItems.suggestedTmdbId} AND ${titles.mediaType}::text = ${recommendationItems.suggestedMediaType}`
    )
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
