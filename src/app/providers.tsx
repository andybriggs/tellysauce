"use client";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import BadgeProvider from "@/components/badges/BadgeProvider";
import RegionProvider from "@/components/common/RegionProvider";

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <RegionProvider>
        <BadgeProvider>{children}</BadgeProvider>
      </RegionProvider>
    </SessionProvider>
  );
}
