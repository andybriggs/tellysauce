import { ChevronLeftIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

interface BackLinkProps {
  href: string;
  label?: string;
}

export default function BackLink({ href, label = "Back" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
      aria-label="Go back"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  );
}
