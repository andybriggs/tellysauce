import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const types = searchParams.get("types") || "movie,tv"; // Watchmode Search types

  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }
  const apiKey = process.env.WATCHMODE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "WATCHMODE_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Watchmode Search API: /v1/search/?search_field=name&search_value=... (&types=movie,tv)
  // Docs: https://api.watchmode.com/v1/search/ (see "Search API")
  const url =
    `https://api.watchmode.com/v1/search/?apiKey=${apiKey}` +
    `&search_field=name&search_value=${encodeURIComponent(q)}` +
    `&types=${encodeURIComponent(types)}`;

  const r = await fetch(url, { next: { revalidate: 0 } });
  if (!r.ok) {
    return NextResponse.json(
      { error: `Watchmode search failed (${r.status})` },
      { status: 502 }
    );
  }

  const data = await r.json();
  const results: Array<{
    id: number;
    name: string;
    type?: string;
    year?: number;
  }> = Array.isArray(data?.title_results) ? data.title_results : [];

  const best = pickBest(results, q);
  return NextResponse.json({ id: best?.id ?? null, results });
}

function pickBest(
  results: Array<{ id: number; name: string; type?: string; year?: number }>,
  q: string
) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const nq = norm(q);

  return results
    .map((r) => {
      const nr = norm(r.name);
      let score = 0;
      if (nr === nq) score += 100; // exact match
      if (nr.startsWith(nq)) score += 40; // prefix
      if (nr.includes(nq)) score += 20; // substring
      if (r.type === "tv") score += 5; // tiny bias toward series
      return { ...r, _score: score };
    })
    .sort((a, b) => b._score - a._score)[0];
}
