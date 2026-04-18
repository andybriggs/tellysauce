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
    <div>
      <h2 className="mb-3 text-lg font-semibold text-white">Where to watch</h2>
      {sources?.length ? (
        <ResultsTable data={sources} />
      ) : (
        <p className="text-slate-300">No sources found for {regionLabel}.</p>
      )}
    </div>
  );
}
