"use client";

import { useState } from "react";
import Modal from "@/components/common/Modal";
import AuthButton from "@/components/common/AuthButton";
import RegionPicker from "@/components/common/RegionPicker";
import useIsLoggedIn from "@/hooks/useIsLoggedIn";

/**
 * Mobile header. The inline row fits comfortably from `sm` up, but on a phone
 * the region picker, Pro button and account block overflow, so below that
 * breakpoint everything collapses behind a burger.
 *
 * Fixed rather than in flow so it lines up with the trophy case bubble, which is
 * global and therefore cannot live inside the header. `right-16` leaves room for
 * that bubble at `right-3`; the two are a deliberate pair.
 */
export default function HeaderMenu({
  isSubscriber,
  onManageSubscription,
}: {
  isSubscriber: boolean;
  onManageSubscription: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isLoggedIn = useIsLoggedIn();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        data-testid="header-menu-button"
        className="sm:hidden fixed top-3 right-16 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-gray-900/90 text-white shadow-2xl backdrop-blur transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
            <div>
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
                  onClick={() => {
                    setOpen(false);
                    onManageSubscription();
                  }}
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
