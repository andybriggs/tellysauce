"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
};

export default function PaywallModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md bg-gray-900 rounded-3xl p-8 ring-1 ring-white/10 shadow-2xl text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-400 hover:text-white transition text-xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-4xl mb-4">✨</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Free recommendations used up
        </h2>
        <p className="text-gray-300 mb-6 text-sm">
          You&apos;ve used your 3 free AI recommendations. Upgrade to TellySauce
          Pro for unlimited personalised picks based on your ratings, refreshed
          weekly.
        </p>

        <div className="bg-gradient-to-r from-pink-500 to-orange-400 rounded-2xl p-[1px] mb-6">
          <div className="bg-gray-900 rounded-2xl py-4">
            <div className="text-3xl font-extrabold text-white">£1.99</div>
            <div className="text-gray-400 text-sm">per month</div>
          </div>
        </div>

        <ul className="text-sm text-gray-300 text-left mb-6 space-y-2 px-2">
          <li className="flex items-center gap-2">
            <span className="text-green-400 shrink-0">✓</span>
            Unlimited AI profile recommendations
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400 shrink-0">✓</span>
            Find similar titles for any show or film
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400 shrink-0">✓</span>
            Recommendations refreshed weekly
          </li>
        </ul>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:opacity-90 transition disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Subscribe for £1.99/month"}
        </button>
        <p className="text-xs text-gray-500 mt-3">
          Cancel anytime via your account settings.
        </p>
      </div>
    </div>
  );
}
