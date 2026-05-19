"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";

type Sink = {
  id: string;
  model: string;
  description: string | null;
  imageUrl: string | null;
  finalPrice: number;
};

type Brand = {
  id: string;
  name: string;
  logoUrl: string | null;
  sinks: Sink[];
};

export default function SinkBrandClient({ brand }: { brand: Brand }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/sinksPriceList"
          className="inline-flex text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          Back to Overview
        </Link>
        <div className="flex items-center gap-4">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="h-16 w-auto object-contain"
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {brand.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View current sink pricing for this provider.
            </p>
          </div>
        </div>
      </div>

      {brand.sinks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No sinks available for this provider.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {brand.sinks.map((sink: Sink) => (
            <article
              key={sink.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 shadow-sm flex flex-col"
            >
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 text-center mb-1">
                {sink.model}
              </p>

              <div
                className="w-full aspect-[4/3] rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition"
                onClick={() => sink.imageUrl && setSelectedImage(sink.imageUrl)}
              >
                {sink.imageUrl ? (
                  <img
                    src={sink.imageUrl}
                    alt={sink.description || sink.model}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                    No image
                  </div>
                )}
              </div>

              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center line-clamp-2">
                {sink.description || "No description provided."}
              </p>

              <p className="mt-2 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                ${sink.finalPrice.toFixed(2)}
              </p>
            </article>
          ))}
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative w-full h-full max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedImage}
              alt="Enlarged sink image"
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
