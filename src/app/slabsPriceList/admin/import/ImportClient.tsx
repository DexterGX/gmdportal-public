"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";
import type { NormalizedImportSlab } from "@/lib/slabsImport";

type Brand = {
  id: string;
  name: string;
};

type ExistingSlab = {
  id: string;
  slabNumber: number | null;
  brand: string;
  series: string | null;
  code: string | null;
  color: string;
  finish: string;
  heightIn: number;
  widthIn: number;
  thickness: string;
  squareFeet: number;
  listedPrice: number;
  finalPrice: number;
  status: string;
};

type ImportDiff = {
  newSlabs: NormalizedImportSlab[];
  changedSlabs: {
    existing: ExistingSlab;
    incoming: NormalizedImportSlab;
    changes: string[];
  }[];
  discontinuedSlabs: ExistingSlab[];
};

type ImportSummary = {
  newCount: number;
  changedCount: number;
  discontinuedCount: number;
  totalProcessed: number;
};

export default function ImportPriceListPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "new" | "changed" | "discontinued"
  >("new");

  // Load brands on mount
  useEffect(() => {
    async function loadBrands() {
      try {
        const response = await fetch("/api/slabs/admin/brands");
        if (response.ok) {
          const data = await response.json();
          setBrands(data.brands || []);
        }
      } catch (err) {
        console.error("Failed to load brands:", err);
      }
    }
    loadBrands();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setDiff(null);
      setSummary(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedBrandId) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brandId", selectedBrandId);

      const response = await fetch("/api/slabs/admin/import/preview", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process file");
      }

      setDiff(data.diff);
      setSummary(data.summary);
      setActiveTab("new");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApply = async () => {
    if (!diff) return;

    if (
      !confirm(
        "Are you sure you want to apply these changes? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const response = await fetch("/api/slabs/admin/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newSlabs: diff.newSlabs,
          changedSlabs: diff.changedSlabs.map((c) => ({
            existingId: c.existing.id,
            incoming: c.incoming,
          })),
          discontinuedIds: diff.discontinuedSlabs.map((s) => s.id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to apply changes");
      }

      alert(
        `Import completed! Created: ${data.summary.created}, Updated: ${data.summary.updated}, Discontinued: ${data.summary.discontinued}`
      );

      // Reset state
      setFile(null);
      setDiff(null);
      setSummary(null);
      setSelectedBrandId("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const downloadTemplate = () => {
    const csvContent = `Brand,Series,Code,Color,Finish,H,W,Thickness,SF_Price,Slab_Price,Status
Daltile,Q1,OQ29,Simply Beige,POLISHED,136,79,2cm,35.50,,AVAILABLE
Daltile,Q1,OQ30,Elegant White,POLISHED,136,79,3cm,,2800.00,AVAILABLE`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "slab_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Import Price List
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Upload a brand price list using the GMD template to import or update
          slab data.
        </p>
      </div>

      {/* Template Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Template Format
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Your file must include these columns in order:
                <br />
                <code className="text-xs bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded mt-1 inline-block">
                  Brand | Series | Code | Color | Finish | H | W | Thickness |
                  SF_Price | Slab_Price | Status
                </code>
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                Provide either SF_Price (per square foot) or Slab_Price (per
                slab). Supported formats: CSV, XLSX
              </p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>
      </div>

      {/* Upload Section */}
      {!diff && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="space-y-4">
            {/* Brand Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Brand <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Choose a brand --</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Import will only compare and update slabs for this brand
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select File
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
              />
            </div>

            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{file.name}</span>
                <span className="text-gray-400">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || !selectedBrandId || isUploading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-4 h-4" />
              {isUploading ? "Processing..." : "Upload & Preview"}
            </button>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {diff && summary && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Import Preview
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {summary.newCount} new, {summary.changedCount} updated,{" "}
                    {summary.discontinuedCount} discontinued
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDiff(null);
                    setSummary(null);
                    setFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isApplying ? "Applying..." : "Apply Changes"}
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("new")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "new"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  New Slabs ({summary.newCount})
                </button>
                <button
                  onClick={() => setActiveTab("changed")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "changed"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  Updated ({summary.changedCount})
                </button>
                <button
                  onClick={() => setActiveTab("discontinued")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "discontinued"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  Discontinued ({summary.discontinuedCount})
                </button>
              </div>
            </div>

            <div className="p-4 overflow-x-auto">
              {/* New Slabs Table */}
              {activeTab === "new" && (
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Brand</th>
                      <th className="pb-2 pr-4 font-medium">Color</th>
                      <th className="pb-2 pr-4 font-medium">Finish</th>
                      <th className="pb-2 pr-4 font-medium">Size</th>
                      <th className="pb-2 pr-4 font-medium">Thickness</th>
                      <th className="pb-2 pr-4 font-medium">SF</th>
                      <th className="pb-2 pr-4 font-medium">SF Price</th>
                      <th className="pb-2 pr-4 font-medium">Slab Price</th>
                      <th className="pb-2 pr-4 font-medium">Listed</th>
                      <th className="pb-2 pr-4 font-medium">Final</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-900 dark:text-gray-100">
                    {diff.newSlabs.map((slab, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 pr-4">{slab.brand}</td>
                        <td className="py-2 pr-4">{slab.color}</td>
                        <td className="py-2 pr-4">{slab.finish}</td>
                        <td className="py-2 pr-4">
                          {slab.heightIn}x{slab.widthIn}
                        </td>
                        <td className="py-2 pr-4">{slab.thickness}</td>
                        <td className="py-2 pr-4">
                          {slab.squareFeet.toFixed(1)}
                        </td>
                        <td className="py-2 pr-4">
                          {slab.sfPrice != null
                            ? formatCurrency(slab.sfPrice)
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {slab.slabPrice != null
                            ? formatCurrency(slab.slabPrice)
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {formatCurrency(slab.listedPrice)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatCurrency(slab.finalPrice)}
                        </td>
                        <td className="py-2">{slab.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Changed Slabs Table */}
              {activeTab === "changed" && (
                <div className="space-y-4">
                  {diff.changedSlabs.map((change, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        {change.existing.brand} - {change.existing.color} (
                        {change.existing.finish}, {change.existing.thickness})
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1">
                            Old Values
                          </p>
                          <div className="space-y-1 text-gray-700 dark:text-gray-300">
                            <p>
                              Size: {change.existing.heightIn}x
                              {change.existing.widthIn}
                            </p>
                            <p>SF: {change.existing.squareFeet.toFixed(1)}</p>
                            <p>
                              Listed:{" "}
                              {formatCurrency(change.existing.listedPrice)}
                            </p>
                            <p>
                              Final:{" "}
                              {formatCurrency(change.existing.finalPrice)}
                            </p>
                            <p>Status: {change.existing.status}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1">
                            New Values
                          </p>
                          <div className="space-y-1 text-gray-900 dark:text-white font-medium">
                            <p
                              className={
                                change.changes.includes("heightIn") ||
                                change.changes.includes("widthIn")
                                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                                  : ""
                              }
                            >
                              Size: {change.incoming.heightIn}x
                              {change.incoming.widthIn}
                            </p>
                            <p
                              className={
                                change.changes.includes("squareFeet")
                                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                                  : ""
                              }
                            >
                              SF: {change.incoming.squareFeet.toFixed(1)}
                            </p>
                            <p
                              className={
                                change.changes.includes("listedPrice")
                                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                                  : ""
                              }
                            >
                              Listed:{" "}
                              {formatCurrency(change.incoming.listedPrice)}
                            </p>
                            <p
                              className={
                                change.changes.includes("finalPrice")
                                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                                  : ""
                              }
                            >
                              Final:{" "}
                              {formatCurrency(change.incoming.finalPrice)}
                            </p>
                            <p
                              className={
                                change.changes.includes("status")
                                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                                  : ""
                              }
                            >
                              Status: {change.incoming.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Discontinued Slabs Table */}
              {activeTab === "discontinued" && (
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Brand</th>
                      <th className="pb-2 pr-4 font-medium">Color</th>
                      <th className="pb-2 pr-4 font-medium">Finish</th>
                      <th className="pb-2 pr-4 font-medium">Size</th>
                      <th className="pb-2 pr-4 font-medium">Thickness</th>
                      <th className="pb-2 font-medium">Current Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-900 dark:text-gray-100">
                    {diff.discontinuedSlabs.map((slab) => (
                      <tr
                        key={slab.id}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 pr-4">{slab.brand}</td>
                        <td className="py-2 pr-4">{slab.color}</td>
                        <td className="py-2 pr-4">{slab.finish}</td>
                        <td className="py-2 pr-4">
                          {slab.heightIn}x{slab.widthIn}
                        </td>
                        <td className="py-2 pr-4">{slab.thickness}</td>
                        <td className="py-2">{slab.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
