"use client";

export default function EmptyRecommendations() {
  return (
    <div className="mb-4">
      <h2 className="text-2xl text-white font-bold leading-normal mb-2">
        Recommendations
      </h2>
      <div className="flex items-stretch gap-4 overflow-auto py-4">
        <div className="flex flex-col justify-center items-center rounded-2xl bg-gray-800/60 border-2 border-dashed border-gray-600 text-gray-300 w-48 min-h-[12rem] flex-shrink-0 p-4">
          <p className="text-center text-sm font-medium">
            Rate titles to get recommendations
          </p>
        </div>
      </div>
    </div>
  );
}
