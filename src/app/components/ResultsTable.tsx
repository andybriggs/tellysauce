import { StreamingSource } from "@/app/types";
import Image from "next/image";
import { STREAMING_SOURCES } from "../contants";

type Props = {
  data: StreamingSource[];
};
const ResultsTable = ({ data }: Props) =>
  data?.length > 0 ? (
    <table className="w-full table-auto border-collapse text-sm bg-white/80 dark:bg-gray-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
      <thead>
        <tr>
          <th className="border-b border-gray-300 p-4 pl-8 text-left font-semibold text-gray-800 dark:text-gray-200 dark:border-gray-600">
            Service
          </th>
          <th className="border-b border-gray-300 p-4 text-left font-semibold text-gray-800 dark:text-gray-200 dark:border-gray-600">
            Region
          </th>
          <th className="border-b border-gray-300 p-4 pr-8 text-left font-semibold text-gray-800 dark:text-gray-200 dark:border-gray-600">
            Price
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((source: StreamingSource, i) => (
          <tr key={i}>
            <td className="border-b border-gray-200 p-4 pl-8 text-gray-700 dark:text-gray-400 dark:border-gray-700">
              {Object.prototype.hasOwnProperty.call(
                STREAMING_SOURCES,
                source.name
              ) ? (
                <div>
                  <Image
                    src={`/icons/${
                      STREAMING_SOURCES[
                        source.name as keyof typeof STREAMING_SOURCES
                      ].icon
                    }`}
                    alt={source.name}
                    width={32}
                    height={32}
                    className="inline-block align-middle rounded shadow bg-white"
                  />
                  <span className="inline-block align-middle ml-2">
                    {source.name}
                  </span>
                </div>
              ) : (
                <span className="inline-block align-middle">{source.name}</span>
              )}
            </td>
            <td className="border-b border-gray-200 p-4 text-gray-700 dark:text-gray-400 dark:border-gray-700">
              {source.region}
            </td>
            <td className="border-b border-gray-200 p-4 pr-8 text-gray-700 dark:text-gray-400 dark:border-gray-700">
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
