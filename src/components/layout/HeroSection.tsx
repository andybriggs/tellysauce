export default function HeroSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative w-full z-10">
      <div className="absolute inset-0 bg-[url('/bg1.png')] bg-repeat bg-[length:220px_220px] sm:bg-[length:240px_240px] md:bg-[length:280px_280px]" />
      <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-orange-400 opacity-80" />
      {children}
    </section>
  );
}
