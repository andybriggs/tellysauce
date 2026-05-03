import Image from "next/image";

interface BackdropProps {
  backdropUrl?: string;
}

export default function Backdrop({ backdropUrl }: BackdropProps) {
  return (
    <div className="absolute inset-0 -z-10">
      {backdropUrl ? (
        <Image
          src={backdropUrl}
          alt="Backdrop"
          fill
          priority
          className="object-cover opacity-20 blur-[1px]"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/60 to-slate-950" />
    </div>
  );
}
