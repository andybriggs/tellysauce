import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id as string),
    columns: {
      subscriptionStatus: true,
      freeRecCallsUsed: true,
    },
  });

  return NextResponse.json({
    subscriptionStatus: dbUser?.subscriptionStatus ?? null,
    freeRecCallsUsed: dbUser?.freeRecCallsUsed ?? 0,
  });
}
