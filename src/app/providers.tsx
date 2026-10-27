"use client";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import BadgeProvider from "@/components/badges/BadgeProvider";
import RegionProvider from "@/components/common/RegionProvider";
import HeaderMenu from "@/components/layout/HeaderMenu";

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
        <BadgeProvider>
          {/* Global so every page has nav, and a sibling of the page so the
              fixed burger is not trapped in a page-level stacking context. */}
          <HeaderMenu />
          {children}
        </BadgeProvider>
      </RegionProvider>
    </SessionProvider>
  );
}
