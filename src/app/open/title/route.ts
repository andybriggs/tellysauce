import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.redirect(new URL("/", req.url));

  const res = await fetch(
    new URL(`/api/resolve-title?q=${encodeURIComponent(q)}`, req.url),
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.redirect(new URL(`/?error=resolve-failed`, req.url));
  }

  const { id } = await res.json();
  if (id) {
    return NextResponse.redirect(new URL(`/title/${id}`, req.url));
  }

  return NextResponse.redirect(new URL(`/?error=not-found`, req.url));
}
