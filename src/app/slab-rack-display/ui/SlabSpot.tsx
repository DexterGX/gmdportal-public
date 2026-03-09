import type { SlabSpotStatus } from "./mockData";

const statusStyles: Record<SlabSpotStatus, string> = {
  empty: "bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600",
  occupied: "bg-blue-500 border-blue-500 dark:bg-blue-600 dark:border-blue-600",
  selected:
    "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600",
};

export default function SlabSpot({
  status,
  index,
  onClick,
}: {
  status: SlabSpotStatus;
  index: number;
  onClick?: () => void;
}) {
  const classes = `h-3.5 w-[78%] ml-3 rounded-sm border transition-all duration-150 transform -skew-x-[22deg] hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
    statusStyles[status]
  }`;

  if (!onClick) {
    return (
      <div
        aria-label={`Slab spot ${index + 1}`}
        className={classes}
        title={`Spot ${index + 1}: ${status}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Slab spot ${index + 1}`}
      className={classes}
      title={`Spot ${index + 1}: ${status}`}
    />
  );
}
