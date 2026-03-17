"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RackCard from "./RackCard";
import SlabActions from "./SlabActions";
import { type SlabBayState } from "./mockData";
import { fetchStateFromDb, getSlabsByRack, loadState } from "./storage";

export default function SlabRackDisplayClient({
  userName,
}: {
  userName: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let active = true;
    fetchStateFromDb().then((data) => {
      if (!active || !data) return;
      setState(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const legendItems = useMemo(
    () => [
      { label: "Empty", className: "bg-gray-200 border-gray-300" },
      { label: "Occupied", className: "bg-blue-500 border-blue-500" },
    ],
    [],
  );

  const totals = useMemo(() => {
    const totalCapacity = state.racks
      .filter((rack) => rack.countTowardInventory)
      .reduce((sum, rack) => sum + rack.capacity, 0);
    const totalOccupied = state.slabs.filter((slab) => {
      const rack = state.racks.find((item) => item.id === slab.rackId);
      return rack?.countTowardInventory;
    }).length;
    const percent = totalCapacity
      ? Math.round((totalOccupied / totalCapacity) * 100)
      : 0;
    return { totalCapacity, totalOccupied, percent };
  }, [state]);

  const sortedRacks = useMemo(
    () =>
      [...state.racks].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      ),
    [state.racks],
  );

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
              SlabBay
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Warehouse rack overview
            </p>
            <p className="mt-3 inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-base font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              Total inventory: {totals.totalOccupied}/{totals.totalCapacity}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-gray-200 dark:stroke-gray-700"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-blue-600"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={
                    2 * Math.PI * 42 * (1 - totals.percent / 100)
                  }
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                  {totals.percent}%
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  full
                </span>
              </div>
            </div>
          </div>
        </div>
        <SlabActions state={state} onUpdate={setState} userName={userName} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`h-3 w-6 rounded-sm border ${item.className}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedRacks.map((rack) => {
          const slabs = getSlabsByRack(state, rack.id);
          return (
            <RackCard
              key={rack.id}
              rack={rack}
              occupiedCount={slabs.length}
              onClick={() => router.push(`/slab-rack-display/${rack.id}`)}
            />
          );
        })}
      </div>
    </div>
  );
}
