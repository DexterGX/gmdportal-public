import SlabSpot from "./SlabSpot";
import type { Rack } from "./mockData";

export default function RackCard({
  rack,
  occupiedCount,
  onClick,
}: {
  rack: Rack;
  occupiedCount: number;
  onClick: () => void;
}) {
  const spots = Array.from({ length: rack.capacity }, (_, index) =>
    index < occupiedCount ? "occupied" : "empty",
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Rack {rack.name}
          </h3>
          {rack.note && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {rack.note}
            </p>
          )}
        </div>
        <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">
          {occupiedCount}/{rack.capacity}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {spots.map((spot, index) => (
          <SlabSpot key={`${rack.id}-${index}`} status={spot} index={index} />
        ))}
      </div>
    </button>
  );
}
