import { StreamingSource } from "../page";

type Props = {
  data: StreamingSource[];
};
const ResultsTable = ({ data }: Props) =>
  data.length > 0 && (
    <table className="w-full table-auto border-collapse text-sm w-full max-w-3xl mx-auto">
      <thead>
        <tr>
          <th className="border-b border-gray-200 p-4 pt-0 pb-3 pl-8 text-left font-medium text-gray-400 dark:border-gray-600 dark:text-gray-200">
            Service
          </th>
          <th className="border-b border-gray-200 p-4 pt-0 pb-3 text-left font-medium text-gray-400 dark:border-gray-600 dark:text-gray-200">
            Region
          </th>
          <th className="border-b border-gray-200 p-4 pt-0 pr-8 pb-3 text-left font-medium text-gray-400 dark:border-gray-600 dark:text-gray-200">
            Price
          </th>
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-800">
        {data.map((source: StreamingSource, i) => (
          <tr key={i}>
            <td className="border-b border-gray-100 p-4 pl-8 text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {source.name}
            </td>
            <td className="border-b border-gray-100 p-4 text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {source.region}
            </td>
            <td className="border-b border-gray-100 p-4 pr-8 text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {source.type}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

export default ResultsTable;
