import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
} from "@/server/titleStore";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getWatchlist(session.user.id as string));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tmdbId, mediaType } = await req.json();
  if (!tmdbId || !mediaType) {
    return NextResponse.json(
      { error: "tmdbId and mediaType required" },
      { status: 400 }
    );
  }

  await addToWatchlist(session.user.id as string, Number(tmdbId), mediaType);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tmdbId, mediaType } = await req.json();
  await removeFromWatchlist(
    session.user.id as string,
    Number(tmdbId),
    mediaType
  );
  return NextResponse.json({ ok: true });
}
