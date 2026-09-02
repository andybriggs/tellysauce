"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** id of the element naming this dialog, for aria-labelledby */
  labelledBy?: string;
  /** extra classes on the panel, e.g. "max-w-md" */
  className?: string;
  /** "center" is a standard dialog; "drawer" slides in from the right edge */
  variant?: "center" | "drawer";
};

/**
 * Shared modal shell: portalled to document.body, closes on Escape or backdrop
 * click, locks body scroll and restores focus to the trigger on close.
 *
 * Sits at z-60 so it clears the app's z-50 ceiling (cookie banner, top loader).
 */
export default function Modal({
  open,
  onClose,
  children,
  labelledBy,
  className = "max-w-md",
  variant = "center",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const isDrawer = variant === "drawer";

  return createPortal(
    <div
      data-testid="modal-backdrop"
      className={[
        "fixed inset-0 z-[60] flex bg-black/60 backdrop-blur-sm",
        isDrawer ? "justify-end" : "items-center justify-center p-4",
      ].join(" ")}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={
          isDrawer
            ? `relative h-full w-full ${className} bg-gray-900 ring-1 ring-white/10 shadow-2xl outline-none overflow-y-auto animate-[drawer-in_220ms_ease-out] motion-reduce:animate-none`
            : `relative w-full ${className} bg-gray-900 rounded-3xl ring-1 ring-white/10 shadow-2xl text-center outline-none`
        }
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
