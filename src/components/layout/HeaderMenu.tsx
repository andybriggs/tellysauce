"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Modal from "@/components/common/Modal";
import AuthButton from "@/components/common/AuthButton";
import RegionPicker from "@/components/common/RegionPicker";
import useIsLoggedIn from "@/hooks/useIsLoggedIn";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

/**
 * The site's only navigation. It used to be a phones-only collapse of an inline
 * header row, but My Watchlist and My Rated Titles were only reachable by
 * scrolling the homepage down to their carousels, so the drawer is now the model
 * at every breakpoint and carries them as links.
 *
 * Mounted globally in `providers.tsx` rather than on the homepage, so every page
 * has nav. Fixed rather than in flow so it lines up with the trophy case bubble,
 * which is global and therefore cannot live inside a header. On mobile the two
 * are a deliberate pair - `right-16` leaves room for the bubble at `right-3`;
 * from `sm` up the bubble moves to the middle of the right edge and the burger
 * takes the corner.
 */

type NavLink = { href: string; label: string; authOnly?: boolean };

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "🏠 Home" },
  { href: "/watchlist", label: "🍿 My Watchlist", authOnly: true },
  { href: "/all-rated-titles", label: "⭐ My Rated Titles", authOnly: true },
  { href: "/pricing", label: "✨ Pricing" },
];

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const isLoggedIn = useIsLoggedIn();
  const subStatus = useSubscriptionStatus();
  const pathname = usePathname();

  const isSubscriber = isLoggedIn && subStatus?.subscriptionStatus === "active";

  const handleManageSubscription = async () => {
    setOpen(false);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = (await res.json()) as { url?: string };
    if (data.url) window.location.href = data.url;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        data-testid="header-menu-button"
        className="fixed top-3 right-16 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-gray-900/90 text-white shadow-2xl backdrop-blur transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:right-4"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        variant="drawer"
        className="max-w-xs"
        labelledBy="header-menu-title"
      >
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 id="header-menu-title" className="text-2xl font-bold text-white">
              Menu
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-xl leading-none text-gray-400 transition hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            <nav aria-label="Site" className="flex flex-col gap-1">
              {NAV_LINKS.filter((l) => !l.authOnly || isLoggedIn).map((link) => {
                const isCurrent = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`rounded-xl px-3 py-2.5 text-base font-semibold transition ${
                      isCurrent
                        ? "bg-white/15 text-white"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 pt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Region
              </p>
              <RegionPicker />
            </div>

            {isSubscriber && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Subscription
                </p>
                <button
                  onClick={handleManageSubscription}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/20 hover:text-white"
                >
                  ✨ Pro · Manage
                </button>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {isLoggedIn ? "Account" : "Sign in"}
              </p>
              <AuthButton />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
