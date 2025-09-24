import Image from "next/image";

interface PosterCardProps {
  posterUrl?: string;
  title: string;
}

export default function PosterCard({ posterUrl, title }: PosterCardProps) {
  return (
    <div className="w-[220px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 md:w-[260px]">
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={`${title} poster`}
          width={780}
          height={1170}
          priority
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[2/3] items-center justify-center bg-slate-800 text-slate-300">
          No image
        </div>
      )}
    </div>
  );
}
