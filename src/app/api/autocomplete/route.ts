import { NextResponse } from "next/server";
import type { AutoCompleteResult } from "@/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ results: [] as AutoCompleteResult[] });
  }

  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Server misconfigured: missing TMDB_ACCESS_TOKEN", results: [] },
      { status: 500 }
    );
  }

  const url = new URL("https://api.themoviedb.org/3/search/multi");
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  // Optional:
  // url.searchParams.set("language", "en-GB");
  // url.searchParams.set("region", "GB");

  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `TMDB error: ${upstream.status}`, details: text, results: [] },
        { status: upstream.status }
      );
    }

    /** ---- Types for TMDB multi search ---- */
    type TMDBBase = {
      id: number;
      poster_path?: string | null;
      backdrop_path?: string | null;
    };

    type TMDBMovie = TMDBBase & {
      media_type: "movie";
      title?: string;
      release_date?: string;
    };

    type TMDBTV = TMDBBase & {
      media_type: "tv";
      name?: string;
      first_air_date?: string;
    };

    type TMDBPerson = { media_type: "person" };

    type TMDBMultiResult = TMDBMovie | TMDBTV | TMDBPerson;

    interface TMDBMultiSearchResponse {
      results?: TMDBMultiResult[];
    }

    const data: TMDBMultiSearchResponse = await upstream.json();

    const toImageUrl = (
      path: string | null | undefined,
      size: "w185" | "w300"
    ): string | null =>
      path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

    const results: AutoCompleteResult[] = (data.results ?? [])
      .filter(
        (x): x is TMDBMovie | TMDBTV =>
          x.media_type === "movie" || x.media_type === "tv"
      )
      .map((x) => {
        const isMovie = x.media_type === "movie";

        const title = isMovie ? x.title ?? "" : x.name ?? "";
        const date = isMovie ? x.release_date ?? "" : x.first_air_date ?? "";
        const year = date ? Number(date.slice(0, 4)) : undefined;

        const poster = toImageUrl(x.poster_path, "w185");
        const backdrop = toImageUrl(x.backdrop_path, "w300");

        return {
          id: x.id,
          name: title,
          type: x.media_type,
          year,
          poster,
          backdrop,
        };
      });

    return NextResponse.json({ results });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      {
        error: "Network error contacting TMDB",
        details: e.message,
        results: [],
      },
      { status: 502 }
    );
  }
}
