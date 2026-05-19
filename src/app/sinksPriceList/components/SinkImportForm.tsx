"use client";

import { useEffect, useState } from "react";
import SinkImportPreview from "./SinkImportPreview";

type Brand = { id: string; name: string };

type DiffPayload = {
  newSinks: Array<{
    brandName: string;
    model: string;
    description: string | null;
    dimensions: string;
    listedPrice: number;
    status: string;
  }>;
  updatedSinks: Array<{
    id: string;
    model: string;
    dimensions: string;
    before: { listedPrice: number; status: string; description: string | null };
    after: { listedPrice: number; status: string; description: string | null };
  }>;
  discontinuedSinks: Array<{
    id: string;
    model: string;
    dimensions: string;
    listedPrice: number;
    status: string;
  }>;
};

export default function SinkImportForm() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DiffPayload | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBrands() {
      const res = await fetch("/api/sinks/admin/brands");
      const json = await res.json().catch(() => ({}));
      setBrands(Array.isArray(json?.brands) ? json.brands : []);
    }

    loadBrands();
  }, []);

  async function previewImport() {
    if (!file || !brandId) {
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brandId", brandId);

      const res = await fetch("/api/sinks/admin/import/preview", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to preview import");
      }

      setPreview(json?.diff || null);
    } catch (err: any) {
      setError(err?.message || "Failed to preview import");
    } finally {
      setIsUploading(false);
    }
  }

  async function applyImport() {
    if (!preview || !brandId) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/sinks/admin/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          diff: preview,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to apply import");
      }

      alert("Import applied successfully.");
      setPreview(null);
      setFile(null);
      setBrandId("");
    } catch (err: any) {
      setError(err?.message || "Failed to apply import");
    } finally {
      setIsApplying(false);
    }
  }

  if (preview) {
    return (
      <SinkImportPreview
        diff={preview}
        applying={isApplying}
        onApply={applyImport}
        onBack={() => setPreview(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Import Price List
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Upload and preview sink price list changes.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Template Format
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
            Brand | Model | Description | Dimensions | Price
          </p>
        </div>
        <a
          href="/api/sinks/admin/import/template"
          className="px-3 py-2 text-sm rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
        >
          Download Template
        </a>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Brand
          </label>
          <select
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">-- Choose a brand --</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Import compares only this selected brand.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select File
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={previewImport}
          disabled={!brandId || !file || isUploading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {isUploading ? "Processing..." : "Upload & Preview"}
        </button>
      </div>
    </div>
  );
}
