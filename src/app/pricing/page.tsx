import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import CheckoutButton from "./CheckoutButton";

export const metadata: Metadata = {
  title: "Pricing - TellySauce",
  description: "Simple, transparent pricing for AI-powered TV and film recommendations.",
};

const freeFeatures = [
  "Daily AI picks - trending movies & TV",
  "Search & browse TMDB titles",
  "Watchlist & ratings (1-5 stars)",
  "3 AI recommendation generations (lifetime)",
];

const proFeatures = [
  "Everything in Free",
  "100 AI recommendation generations per month",
  "Manage subscription via billing portal",
];

export default async function PricingPage() {
  const session = await getServerSession(authOptions);

  let isSubscribed = false;
  if (session?.user?.id) {
    const result = await db.execute(
      sql`SELECT subscription_status FROM users WHERE id = ${session.user.id}`
    );
    const row = (result as unknown as { rows?: { subscription_status: string | null }[] }).rows?.[0];
    isSubscribed = row?.subscription_status === "active";
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-gray-300">
      <Link
        href="/"
        className="text-sm text-gray-500 hover:text-gray-300 transition mb-8 inline-block"
      >
        ← Back to TellySauce
      </Link>

      <h1 className="text-3xl font-extrabold text-white mb-2">
        Simple, transparent pricing
      </h1>
      <p className="text-gray-400 mb-12">
        Discover, rate, and get AI-powered recommendations for TV shows and films.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Free tier */}
        <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-8 flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Free</h2>
            <div className="text-3xl font-extrabold text-white">£0</div>
            <div className="text-gray-400 text-sm mt-1">No credit card required</div>
          </div>

          <ul className="space-y-3 text-sm flex-1">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/"
            className="mt-8 block text-center py-3 rounded-2xl font-bold text-white ring-1 ring-white/20 hover:ring-white/40 transition"
          >
            Get started free
          </Link>
        </div>

        {/* Pro tier */}
        <div className="rounded-3xl bg-gradient-to-b from-pink-500/10 to-orange-400/10 ring-1 ring-pink-500/40 p-8 flex flex-col relative">
          <div className="absolute top-4 right-4 text-xs font-semibold bg-gradient-to-r from-pink-500 to-orange-400 text-white px-3 py-1 rounded-full">
            Pro
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">TellySauce Pro</h2>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-white">£1.99</span>
              <span className="text-gray-400 text-sm">/ month</span>
            </div>
            <div className="text-gray-400 text-sm mt-1">Cancel anytime</div>
          </div>

          <ul className="space-y-3 text-sm flex-1">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>

          <CheckoutButton isSubscribed={isSubscribed} />
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-8 text-center">
        Sign in with Google is required to use watchlist, ratings, and AI recommendations.
      </p>
    </div>
  );
}
