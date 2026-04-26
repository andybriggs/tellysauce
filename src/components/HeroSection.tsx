"use client";

import { useCallback, useEffect, useRef } from "react";

export default function HeroSection({ children }: { children: React.ReactNode }) {
  const bgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const mouseOffset = useRef({ x: 0, y: 0 });
  const scrollOffset = useRef(0);

  const updateBg = useCallback(() => {
    if (!bgRef.current) return;
    bgRef.current.style.backgroundPosition = `${mouseOffset.current.x}px ${mouseOffset.current.y + scrollOffset.current}px`;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseOffset.current = {
        x: (e.clientX - (rect.left + rect.width / 2)) * 0.03,
        y: (e.clientY - (rect.top + rect.height / 2)) * 0.03,
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateBg);
    },
    [updateBg]
  );

  useEffect(() => {
    const onScroll = () => {
      scrollOffset.current = window.scrollY * 0.25;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateBg);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [updateBg]);

  return (
    <section className="relative w-full z-10" onMouseMove={handleMouseMove}>
      <div
        ref={bgRef}
        className="absolute inset-0 bg-[url('/bg1.png')] bg-repeat bg-[length:220px_220px] sm:bg-[length:240px_240px] md:bg-[length:280px_280px]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80" />
      {children}
    </section>
  );
}
