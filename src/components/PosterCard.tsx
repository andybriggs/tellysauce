import Image from "next/image";

interface PosterCardProps {
  posterUrl?: string;
  title: string;
}

export default function PosterCard({ posterUrl, title }: PosterCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={`${title} poster`}
          width={100}
          height={100}
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
