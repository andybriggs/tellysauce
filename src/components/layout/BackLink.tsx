"use client";

import { ChevronLeftIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";

interface BackLinkProps {
  fallbackHref?: string;
  label?: string;
}

export default function BackLink({
  fallbackHref = "/",
  label = "Back",
}: BackLinkProps) {
  const router = useRouter();

  function handleClick() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="
      ml-auto inline-flex items-center gap-1.5
      rounded-full border border-white/10
      bg-white/5 px-3 py-1.5
      text-sm font-medium text-white
      transition
      hover:bg-white/10 hover:border-white/20
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40
    "
      aria-label="Go back"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      {label}
    </button>
  );
}
