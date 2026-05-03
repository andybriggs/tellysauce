import { StreamingSource } from "@/types";
import Image from "next/image";

type Props = {
  data: StreamingSource[];
};

const ResultsTable = ({ data }: Props) =>
  data?.length > 0 ? (
    <table className="w-full table-auto border-collapse text-sm">
      <tbody>
        {data.map((source: StreamingSource, i) => (
          <tr key={i} className="border-b border-white/10 last:border-0">
            <td className="py-2 pr-4">
              <div className="relative group inline-block">
                <Image
                  src={`https://image.tmdb.org/t/p/original/${source.icon}`}
                  alt={source.name}
                  width={32}
                  height={32}
                  className="inline-block align-middle rounded shadow bg-white"
                />
                <span className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  {source.name}
                </span>
              </div>
            </td>
            <td className="py-2 text-slate-300 capitalize">
              {source.type}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p className="text-white">No sources found</p>
  );

export default ResultsTable;
