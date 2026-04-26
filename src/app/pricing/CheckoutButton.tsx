"use client";

import { useState } from "react";

export default function CheckoutButton({ isSubscribed }: { isSubscribed: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSubscribed) {
    return (
      <button
        disabled
        className="mt-8 w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-pink-500 to-orange-400 opacity-50 cursor-not-allowed"
      >
        Already subscribed
      </button>
    );
  }

  return (
    <div className="mt-8">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:opacity-90 transition disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Get Pro - £1.99/month"}
      </button>
      {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
    </div>
  );
}
