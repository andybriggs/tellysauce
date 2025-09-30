interface MetaPillsProps {
  year?: number;
  endYear?: number;
  type?: string;
  usRating?: string;
  language?: string;
}

export default function MetaPills({
  year,
  endYear,
  type,
  usRating,
  language,
}: MetaPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300/90">
      {typeof year === "number" && (
        <span className="rounded-full bg-slate-800/70 px-2 py-1 ring-1 ring-white/10">
          {year}
          {endYear ? `–${endYear}` : ""}
        </span>
      )}
      {type && (
        <span className="rounded-full bg-slate-800/70 px-2 py-1 ring-1 ring-white/10 capitalize">
          {type.replaceAll("_", " ")}
        </span>
      )}
      {usRating && (
        <span className="rounded-full bg-slate-800/70 px-2 py-1 ring-1 ring-white/10">
          {usRating}
        </span>
      )}
      {language && (
        <span className="rounded-full bg-slate-800/70 px-2 py-1 ring-1 ring-white/10 uppercase">
          {language}
        </span>
      )}
    </div>
  );
}
