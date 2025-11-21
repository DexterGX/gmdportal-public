"use client";

import { useState } from "react";

// TODO: Replace with actual data from API/database
type SlabProvider = {
  id: string;
  name: string;
  logoUrl: string;
  description?: string;
  totalColors?: number;
};

const MOCK_PROVIDERS: SlabProvider[] = [
  {
    id: "1",
    name: "Caesarstone",
    logoUrl: "/logos/caesarstone.png",
    description: "Premium quartz surfaces",
    totalColors: 45,
  },
  {
    id: "2",
    name: "Silestone",
    logoUrl: "/logos/silestone.png",
    description: "Cosentino quartz collection",
    totalColors: 67,
  },
  {
    id: "3",
    name: "Cambria",
    logoUrl: "/logos/cambria.png",
    description: "American-made quartz",
    totalColors: 52,
  },
  {
    id: "4",
    name: "MSI",
    logoUrl: "/logos/msi.png",
    description: "Q Quartz collection",
    totalColors: 38,
  },
  {
    id: "5",
    name: "Dekton",
    logoUrl: "/logos/dekton.png",
    description: "Ultra-compact surfaces",
    totalColors: 41,
  },
  {
    id: "6",
    name: "LG Viatera",
    logoUrl: "/logos/viatera.png",
    description: "Engineered quartz",
    totalColors: 29,
  },
];

export default function SlabsOverview() {
  const [providers] = useState<SlabProvider[]>(MOCK_PROVIDERS);

  // TODO: Fetch real data from API
  // useEffect(() => {
  //   async function fetchProviders() {
  //     const res = await fetch('/api/slabs/providers');
  //     const data = await res.json();
  //     setProviders(data);
  //   }
  //   fetchProviders();
  // }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Select a slab provider to view or manage pricing.
        </p>
      </div>

      {providers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No slab providers found. Please add providers to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <button
              key={provider.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  {/* TODO: Replace with actual logo images */}
                  <span className="text-4xl font-bold text-gray-400 dark:text-gray-500">
                    {provider.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {provider.name}
                  </h3>
                  {provider.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {provider.description}
                    </p>
                  )}
                  {provider.totalColors !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {provider.totalColors} colors available
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
