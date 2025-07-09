import { StreamingSource } from "../page";

type Props = {
  data: StreamingSource[];
};
const ResultsTable = ({ data }: Props) =>
  data?.length > 0 ? (
    <table className="w-full table-auto border-collapse text-sm max-w-3xl mx-auto bg-white/80 dark:bg-gray-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
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
              {source.name}
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
    <div className="bg-blue-500 text-white text-center p-4 rounded">
      <p>No sources found</p>
    </div>
  );

export default ResultsTable;
