import ResultsTable from "@/components/ResultsTable";
import { StreamingSource } from "@/types/";

interface WhereToWatchProps {
  sources: StreamingSource[];
  regionLabel?: string;
}

export default function WhereToWatch({
  sources,
  regionLabel = "GB",
}: WhereToWatchProps) {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold text-white">Where to watch</h2>
      <div className="max-h-[385px] overflow-y-auto overflow-x-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
        {sources?.length ? (
          <ResultsTable data={sources} />
        ) : (
          <div className="p-6 text-slate-300">
            No sources found for {regionLabel}.
          </div>
        )}
      </div>
    </>
  );
}
