interface TagsListProps {
  genres?: string[];
  networks?: string[];
}

export default function TagsList({ genres, networks }: TagsListProps) {
  if (!genres?.length && !networks?.length) return null;
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">Tags</div>
      <div className="flex flex-wrap gap-2">
        {genres?.map((g) => (
          <span
            key={g}
            className="rounded-full bg-slate-800/70 px-3 py-1 text-sm text-slate-200 ring-1 ring-white/10"
          >
            {g}
          </span>
        ))}
        {networks?.map((n) => (
          <span
            key={n}
            className="rounded-full bg-sky-800/40 px-3 py-1 text-sm text-sky-100 ring-1 ring-sky-400/20"
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
