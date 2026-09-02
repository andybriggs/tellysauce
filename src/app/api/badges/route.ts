import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  awardAllBadges,
  getBadgeProgress,
  getUserBadges,
  markBadgesSeen,
} from "@/server/badges";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  // Catch up anything the user already qualifies for before reporting, so
  // history that predates the badge system is not stuck showing as locked.
  await awardAllBadges(userId);

  const [badges, progress] = await Promise.all([
    getUserBadges(userId),
    getBadgeProgress(userId),
  ]);
  return NextResponse.json({ badges, progress });
}

/** Marks badges as seen so their unlock modal is not shown again. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keys } = await req.json();
  if (!Array.isArray(keys)) {
    return NextResponse.json({ error: "keys array required" }, { status: 400 });
  }

  await markBadgesSeen(
    session.user.id as string,
    keys.filter((k): k is string => typeof k === "string")
  );
  return NextResponse.json({ ok: true });
}
