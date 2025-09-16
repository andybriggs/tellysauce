import ResultsTable from "@/app/components/ResultsTable";
import { StreamingSource } from "../types";

interface WhereToWatchProps {
  sources: StreamingSource[];
  regionLabel?: string;
}

export default function WhereToWatch({
  sources,
  regionLabel = "GB",
}: WhereToWatchProps) {
  return (
    <section className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Where to watch
        </h2>
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
          {sources?.length ? (
            <ResultsTable data={sources} />
          ) : (
            <div className="p-6 text-slate-300">
              No sources found for {regionLabel}.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
