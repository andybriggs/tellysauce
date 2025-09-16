interface MetaPillsProps {
  year?: number;
  endYear?: number;
  type?: string;
  usRating?: string;
  userRating?: number;
  criticScore?: number;
  language?: string;
}

export default function MetaPills({
  year,
  endYear,
  type,
  usRating,
  userRating,
  criticScore,
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
      {typeof userRating === "number" && (
        <span className="rounded-full bg-emerald-700/30 px-2 py-1 text-emerald-300 ring-1 ring-emerald-400/20">
          User {userRating.toFixed(1)}
        </span>
      )}
      {typeof criticScore === "number" && (
        <span className="rounded-full bg-indigo-700/30 px-2 py-1 text-indigo-200 ring-1 ring-indigo-400/20">
          Critics {criticScore}
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
