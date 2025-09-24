// app/open/title/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type MediaKind = "movie" | "tv";
type SearchParams = {
  q?: string;
  kind?: MediaKind;
  year?: string;
  imdbId?: string;
  desc?: string;
  tags?: string;
  language?: string;
  region?: string;
  minScore?: string;
};

type ResolveResponse = {
  id: number | null;
  kind: MediaKind | null;
};

export const dynamic = "force-dynamic"; // ensure no static caching

export default async function OpenTitlePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { q, kind, year, imdbId, desc, tags } = sp;

  // Guard: need at least q or imdbId
  if (!q && !imdbId) redirect("/");

  // Build absolute URL to your resolver API
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const origin = `${proto}://${host}`;

  const url = new URL(`${origin}/api/resolve-title`);
  if (q) url.searchParams.set("q", q);
  if (kind) url.searchParams.set("kind", kind);
  if (year) url.searchParams.set("year", year);
  if (imdbId) url.searchParams.set("imdbId", imdbId);
  if (desc) url.searchParams.set("desc", desc);
  if (tags) url.searchParams.set("tags", tags);
  // sensible defaults for better ranking (optional)
  url.searchParams.set("language", "en-GB");
  url.searchParams.set("region", "GB");

  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) redirect("/");

  const data = (await r.json()) as ResolveResponse;

  if (data.id && data.kind) {
    redirect(`/title/${data.kind}/${data.id}`);
  }

  // No confident match → send home (or build a nicer fallback page later)
  redirect("/");
}
