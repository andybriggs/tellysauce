import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure Node runtime for process.env

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  // Quick short-circuit for empty queries
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.WATCHMODE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing WATCHMODE_API_KEY", results: [] },
      { status: 500 }
    );
  }

  const url = new URL("https://api.watchmode.com/v1/autocomplete-search/");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("search_field", "name");
  url.searchParams.set("search_value", q);

  try {
    // For search, avoid caching (you can adjust if you want some revalidation)
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Watchmode error: ${upstream.status}`,
          details: text,
          results: [],
        },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    // Only return what you need; this also avoids leaking internal details
    return NextResponse.json({ results: data?.results ?? [] });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      {
        error: "Network error contacting Watchmode",
        details: e?.message,
        results: [],
      },
      { status: 502 }
    );
  }
}
