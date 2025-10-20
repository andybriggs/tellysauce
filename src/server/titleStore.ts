import { db } from "@/db";
import { titles, userTitles } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { fetchTMDBTitle } from "./tmdb";

export type MediaType = "tv" | "movie";

export type UpsertTitleArgs = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster?: string | null;
  year?: number | null;
  description?: string | null;
};

export async function ensureTitle(tmdbId: number, mediaType: MediaType) {
  // 1) try DB
  const existing = await db
    .select()
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // 2) fetch from TMDB
  const fetched = await fetchTMDBTitle(tmdbId, mediaType);
  if (!fetched || !fetched.title || fetched.title.trim() === "") {
    throw new Error(`Title ${mediaType}:${tmdbId} not found on TMDB`);
  }

  // 3) insert minimal row (no overwrite risk)
  await db
    .insert(titles)
    .values({
      tmdbId: fetched.tmdbId,
      mediaType: fetched.mediaType,
      title: fetched.title,
      poster: fetched.poster,
      year: fetched.year,
      description: fetched.description,
    })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)))
    .limit(1);
  return row!;
}

export async function addToWatchlist(
  userId: string,
  tmdbId: number,
  mediaType: MediaType
) {
  const t = await ensureTitle(tmdbId, mediaType);
  await db.execute(sql`
    INSERT INTO "user_titles" ("user_id","title_id","status","rating","rated_at")
    VALUES (${userId}, ${t.id}, 'WATCHLIST', NULL, NULL)
    ON CONFLICT ON CONSTRAINT "user_titles_user_title_unique"
    DO UPDATE SET
      "status" = 'WATCHLIST',
      "rating" = NULL,
      "rated_at" = NULL,
      "updated_at" = now()
  `);
}

export async function removeFromWatchlist(
  userId: string,
  tmdbId: number,
  mediaType: MediaType
) {
  const [t] = await db
    .select({ id: titles.id })
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)))
    .limit(1);
  if (!t) return;
  await db
    .delete(userTitles)
    .where(
      and(
        eq(userTitles.userId, userId),
        eq(userTitles.titleId, t.id),
        eq(userTitles.status, "WATCHLIST")
      )
    );
}

export async function rateTitle(
  userId: string,
  tmdbId: number,
  mediaType: MediaType,
  rating: number
) {
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  const t = await ensureTitle(tmdbId, mediaType);

  await db.execute(sql`
    INSERT INTO "user_titles" ("user_id","title_id","status","rating","rated_at")
    VALUES (${userId}, ${t.id}, 'RATED', ${r}, now())
    ON CONFLICT ON CONSTRAINT "user_titles_user_title_unique"
    DO UPDATE SET
      "status" = 'RATED',
      "rating" = ${r},
      "rated_at" = now(),
      "updated_at" = now()
  `);
}

export async function getWatchlist(userId: string) {
  const rows = await db
    .select({
      id: titles.tmdbId,
      type: titles.mediaType,
      name: titles.title,
      poster: titles.poster,
      year: titles.year,
      description: titles.description,
    })
    .from(userTitles)
    .innerJoin(titles, eq(userTitles.titleId, titles.id))
    .where(
      and(eq(userTitles.userId, userId), eq(userTitles.status, "WATCHLIST"))
    )
    .orderBy(desc(userTitles.addedAt));

  return rows;
}

export async function getRated(userId: string) {
  const rows = await db
    .select({
      id: titles.tmdbId,
      type: titles.mediaType,
      name: titles.title,
      poster: titles.poster,
      year: titles.year,
      description: titles.description,
      rating: userTitles.rating,
      ratedAt: userTitles.ratedAt,
    })
    .from(userTitles)
    .innerJoin(titles, eq(userTitles.titleId, titles.id))
    .where(and(eq(userTitles.userId, userId), eq(userTitles.status, "RATED")))
    .orderBy(desc(userTitles.ratedAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    poster: r.poster,
    type: r.type,
    description: r.description,
    rating: r.rating ?? 0,
    year: r.year ?? undefined,
  }));
}

export async function getRating(
  userId: string,
  tmdbId: number,
  mediaType: MediaType
) {
  const [t] = await db
    .select({ id: titles.id })
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)))
    .limit(1);
  if (!t) return 0;
  const [row] = await db
    .select({ status: userTitles.status, rating: userTitles.rating })
    .from(userTitles)
    .where(and(eq(userTitles.userId, userId), eq(userTitles.titleId, t.id)))
    .limit(1);
  return row?.status === "RATED" ? row.rating ?? 0 : 0;
}

export async function isSaved(
  userId: string,
  tmdbId: number,
  mediaType: MediaType
) {
  const [t] = await db
    .select({ id: titles.id })
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)))
    .limit(1);
  if (!t) return false;
  const [row] = await db
    .select({ id: userTitles.id })
    .from(userTitles)
    .where(and(eq(userTitles.userId, userId), eq(userTitles.titleId, t.id)))
    .limit(1);
  return !!row;
}
