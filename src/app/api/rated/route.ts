import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateTitle, getRated } from "@/server/titleStore";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getRated(session.user.id as string));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tmdbId, mediaType, rating } = await req.json();
  if (!tmdbId || !mediaType || typeof rating !== "number") {
    return NextResponse.json(
      { error: "tmdbId, mediaType, rating required" },
      { status: 400 }
    );
  }

  await rateTitle(session.user.id as string, Number(tmdbId), mediaType, rating);
  return NextResponse.json({ ok: true });
}
