import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — TellySauce",
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-gray-300">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition mb-8 inline-block">
        ← Back to TellySauce
      </Link>

      <h1 className="text-3xl font-extrabold text-white mb-2">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: April 2025</p>

      <Section title="Who we are">
        <p>
          TellySauce (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a web application for discovering,
          rating, and getting AI-powered recommendations for TV shows and films.
          The service is operated by Andy Briggs, based in the United Kingdom.
        </p>
        <p className="mt-3">
          For any privacy enquiries, contact us at:{" "}
          <a href="mailto:hello@tellysauce.com" className="text-white underline hover:text-gray-200 transition">
            hello@tellysauce.com
          </a>
        </p>
      </Section>

      <Section title="What data we collect and why">
        <h3 className="font-semibold text-white mt-4 mb-1">Account information</h3>
        <p>
          When you sign in with Google, we receive your name, email address, and
          profile picture from Google OAuth. We store your name and email in our
          database to identify your account. Your profile picture is used only
          to display your avatar in the app and is not stored by us.
        </p>

        <h3 className="font-semibold text-white mt-4 mb-1">Watchlist and ratings</h3>
        <p>
          We store the titles you add to your watchlist and any star ratings you
          give. This data is used to power your personalised AI recommendations
          and is visible only to you.
        </p>

        <h3 className="font-semibold text-white mt-4 mb-1">AI recommendations</h3>
        <p>
          When you generate recommendations, a summary of your rated titles is
          sent to Google&apos;s Gemini API to generate personalised suggestions.
          We do not send your name, email, or any other personally identifiable
          information to Gemini.
        </p>

        <h3 className="font-semibold text-white mt-4 mb-1">Payment information</h3>
        <p>
          If you subscribe to TellySauce Pro, payments are processed by Stripe.
          We never see or store your card details. We store only a Stripe
          customer ID and subscription status in our database to manage your
          access.
        </p>

        <h3 className="font-semibold text-white mt-4 mb-1">Usage analytics</h3>
        <p>
          We use Vercel Analytics to understand how the site is used in aggregate.
          This data is anonymised and not linked to your account.
        </p>
      </Section>

      <Section title="Cookies">
        <p>We use the following cookies:</p>
        <ul className="mt-3 space-y-2 list-disc list-inside">
          <li>
            <span className="text-white font-medium">Session cookie</span> — set
            by NextAuth to keep you signed in. This is strictly necessary and
            cannot be disabled without breaking sign-in.
          </li>
          <li>
            <span className="text-white font-medium">Analytics</span> — Vercel
            Analytics may use a lightweight identifier to distinguish sessions.
            No personal data is collected.
          </li>
          <li>
            <span className="text-white font-medium">Cookie consent</span> — we
            store a flag in your browser&apos;s local storage to remember that
            you&apos;ve acknowledged this notice.
          </li>
        </ul>
      </Section>

      <Section title="Third-party services">
        <p>We share data with the following third parties in order to operate the service:</p>
        <ul className="mt-3 space-y-3 list-disc list-inside">
          <li>
            <span className="text-white font-medium">Google (OAuth)</span> —
            handles sign-in. Subject to{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition">
              Google&apos;s Privacy Policy
            </a>.
          </li>
          <li>
            <span className="text-white font-medium">Google Gemini</span> —
            generates your AI recommendations using anonymised viewing data.
          </li>
          <li>
            <span className="text-white font-medium">Stripe</span> — processes
            subscription payments. Subject to{" "}
            <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition">
              Stripe&apos;s Privacy Policy
            </a>.
          </li>
          <li>
            <span className="text-white font-medium">Vercel</span> — hosts the
            application and provides anonymised analytics.
          </li>
          <li>
            <span className="text-white font-medium">TMDB (The Movie Database)</span> —
            provides title metadata, posters, and descriptions. We do not share
            any personal data with TMDB.
          </li>
          <li>
            <span className="text-white font-medium">Neon</span> — hosts our
            PostgreSQL database in the UK (AWS eu-west-2, London).
          </li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p>
          We retain your account data, watchlist, and ratings for as long as you
          have an account with us. If you would like your data deleted, contact
          us at the email address above and we will remove your account and all
          associated data within 30 days.
        </p>
      </Section>

      <Section title="Your rights under UK GDPR">
        <p>As a UK resident, you have the right to:</p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
          <li>Object to or restrict processing</li>
          <li>Data portability</li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, please contact us at{" "}
          <a href="mailto:hello@tellysauce.com" className="text-white underline hover:text-gray-200 transition">
            hello@tellysauce.com
          </a>.
          You also have the right to lodge a complaint with the{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition">
            Information Commissioner&apos;s Office (ICO)
          </a>.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be
          reflected with an updated date at the top of this page.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-3 pb-2 border-b border-white/10">{title}</h2>
      <div className="text-gray-300 leading-relaxed text-sm">{children}</div>
    </section>
  );
}
