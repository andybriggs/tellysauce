"use client";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import BadgeProvider from "@/components/badges/BadgeProvider";

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <BadgeProvider>{children}</BadgeProvider>
    </SessionProvider>
  );
}
