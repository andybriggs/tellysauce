import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-16">
      <div className="max-w-screen-xl mx-auto px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <span>© {new Date().getFullYear()} TellySauce. All rights reserved.</span>
        <nav className="flex items-center gap-6">
          <Link href="/privacy" className="hover:text-gray-300 transition">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-300 transition">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
