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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5 transition group-hover:-translate-x-0.5"
      >
        <path
          fillRule="evenodd"
          d="M12.53 4.47a.75.75 0 010 1.06L7.06 11l5.47 5.47a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </Link>
  );
}
