"use client";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  brandId: string;
  onBrandChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  dimensions: string;
  onDimensionsChange: (value: string) => void;
  brandOptions: Array<{ id: string; name: string }>;
};

export default function SinkFilters({
  search,
  onSearchChange,
  brandId,
  onBrandChange,
  status,
  onStatusChange,
  dimensions,
  onDimensionsChange,
  brandOptions,
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by model or description..."
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
        />

        <select
          value={brandId}
          onChange={(event) => onBrandChange(event.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
        >
          <option value="">Brand: Any</option>
          {brandOptions.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
        >
          <option value="">Status: Any</option>
          <option value="AVAILABLE">AVAILABLE</option>
          <option value="DISCONTINUED">DISCONTINUED</option>
        </select>

        <input
          value={dimensions}
          onChange={(event) => onDimensionsChange(event.target.value)}
          placeholder="Dimensions contains..."
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
        />
      </div>
    </div>
  );
}
