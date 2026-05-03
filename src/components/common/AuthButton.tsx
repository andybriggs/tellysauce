"use client";

import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-9 w-40 animate-pulse rounded-full bg-gray-200" />;
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={() =>
          signIn("google", {
            callbackUrl:
              typeof window !== "undefined" ? window.location.href : "/",
          })
        }
        className="inline-flex items-center gap-3 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50 hover:bg-gray-100"
      >
        {/* Google 'G' mark */}
        <svg viewBox="0 0 48 48" aria-hidden="true" className="h-4 w-4">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1112 24c0-6.63 5.37-12 12-12 3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C33.53 6.25 29.03 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.26-.13-2.49-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.31 14.69l6.57 4.82A12 12 0 0124 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C33.53 6.25 29.03 4 24 4 16.2 4 9.59 8.46 6.31 14.69z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c4.86 0 9.27-1.86 12.62-4.9l-5.83-4.94A12 12 0 0112 24H4c0 11.05 8.95 20 20 20z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3a12 12 0 01-4.11 5.61l.01.01 5.83 4.94C39.32 40.14 44 33.87 44 24c0-1.26-.13-2.49-.4-3.5z"
          />
        </svg>
        Sign in with Google
      </button>
    );
  }

  const { user } = session;
  return (
    <div className="relative inline-flex items-center gap-3 bg-white/80 px-1 py-1 rounded-full">
      <Image
        src={user?.image ?? ""}
        alt={user?.name ?? "User"}
        className="h-8 w-8 rounded-full"
        height={32}
        width={32}
      />
      <span className="text-sm">{user?.name ?? user?.email}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="ml-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs hover:bg-gray-100"
      >
        Sign out
      </button>
    </div>
  );
}
