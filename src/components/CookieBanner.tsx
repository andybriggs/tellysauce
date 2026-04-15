"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-screen-xl mx-auto bg-gray-900 border border-white/10 rounded-2xl shadow-2xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-gray-300 leading-relaxed">
          We use cookies to keep you signed in and to understand how the site is
          used via anonymised analytics. See our{" "}
          <Link href="/privacy" className="underline text-gray-200 hover:text-white transition">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:opacity-90 transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
