"use client";

import { useMemo, useState } from "react";
import { Edit, Plus, Save, Trash2, X } from "lucide-react";
import SinkImageUploader from "./SinkImageUploader";
import SinkFilters from "./SinkFilters";

type Brand = { id: string; name: string };

type Row = {
  id: string;
  brandId: string;
  brandName: string;
  model: string;
  description: string | null;
  dimensions: string;
  listedPrice: number;
  finalPrice: number;
  status: "AVAILABLE" | "DISCONTINUED";
  isPromotional: boolean;
  promotionalPrice: number | null;
  imageUrl: string | null;
  updatedAt: string;
  _dirty?: boolean;
  _deleted?: boolean;
  _isNew?: boolean;
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function SinksDataTable({
  initialRows,
  brands,
}: {
  initialRows: Row[];
  brands: Brand[];
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState("");
  const [status, setStatus] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = rows.some(
    (row) => row._dirty || row._deleted || row._isNew,
  );

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, ...patch, _dirty: true } : row,
      ),
    );
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const dimTerm = dimensions.trim().toLowerCase();

    return rows.filter((row) => {
      if (row._deleted) {
        return false;
      }

      if (term) {
        const haystack = `${row.model} ${row.description || ""}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }

      if (brandId && row.brandId !== brandId) {
        return false;
      }

      if (status && row.status !== status) {
        return false;
      }

      if (dimTerm && !row.dimensions.toLowerCase().includes(dimTerm)) {
        return false;
      }

      return true;
    });
  }, [rows, search, brandId, status, dimensions]);

  function addSink() {
    const firstBrand = brands[0];
    if (!firstBrand) {
      alert("Please create at least one brand first.");
      return;
    }

    setRows((prev) => [
      {
        id: `new-${Date.now()}`,
        brandId: firstBrand.id,
        brandName: firstBrand.name,
        model: "",
        description: null,
        dimensions: "",
        listedPrice: 0,
        finalPrice: 0,
        status: "AVAILABLE",
        isPromotional: false,
        promotionalPrice: null,
        imageUrl: null,
        updatedAt: new Date().toISOString(),
        _dirty: true,
        _isNew: true,
      },
      ...prev,
    ]);
  }

  async function saveAll() {
    setIsSaving(true);
    try {
      const changed = rows.filter(
        (row) => row._dirty || row._deleted || row._isNew,
      );
      const response = await fetch("/api/sinks/admin/sinks/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinks: changed }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "Failed to save sinks");
      }
      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "Failed to save sinks");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SinkFilters
        search={search}
        onSearchChange={setSearch}
        brandId={brandId}
        onBrandChange={setBrandId}
        status={status}
        onStatusChange={setStatus}
        dimensions={dimensions}
        onDimensionsChange={setDimensions}
        brandOptions={brands}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {hasChanges ? "You have unsaved changes" : "All changes saved"}
        </p>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={!hasChanges || isSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={addSink}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Sink
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Sink ID</th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-left">Model</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Dimensions</th>
              <th className="px-3 py-2 text-left">Listed Price</th>
              <th className="px-3 py-2 text-left">Final Price</th>
              <th className="px-3 py-2 text-left">Promotional</th>
              <th className="px-3 py-2 text-left">Image</th>
              {isEditing ? (
                <th className="px-3 py-2 text-left">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className="border-t border-gray-100 dark:border-gray-700"
              >
                <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <select
                      value={row.brandId}
                      onChange={(event) => {
                        const nextBrand = brands.find(
                          (brand) => brand.id === event.target.value,
                        );
                        patchRow(row.id, {
                          brandId: event.target.value,
                          brandName: nextBrand?.name || row.brandName,
                        });
                      }}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                    >
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    row.brandName
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      value={row.model}
                      onChange={(event) =>
                        patchRow(row.id, { model: event.target.value })
                      }
                      className="w-full px-2 py-1 border rounded"
                    />
                  ) : (
                    row.model
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      value={row.description || ""}
                      onChange={(event) =>
                        patchRow(row.id, {
                          description: event.target.value || null,
                        })
                      }
                      className="w-full px-2 py-1 border rounded"
                    />
                  ) : (
                    row.description || "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      value={row.dimensions}
                      onChange={(event) =>
                        patchRow(row.id, { dimensions: event.target.value })
                      }
                      className="w-full px-2 py-1 border rounded"
                    />
                  ) : (
                    row.dimensions
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={row.listedPrice}
                      onChange={(event) =>
                        patchRow(row.id, {
                          listedPrice: Number(event.target.value) || 0,
                        })
                      }
                      className="w-28 px-2 py-1 border rounded"
                    />
                  ) : (
                    fmt(row.listedPrice)
                  )}
                </td>
                <td className="px-3 py-2">{fmt(row.finalPrice)}</td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <div className="space-y-1">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.isPromotional}
                          onChange={(event) =>
                            patchRow(row.id, {
                              isPromotional: event.target.checked,
                            })
                          }
                        />
                        <span>Promo</span>
                      </label>
                      {row.isPromotional ? (
                        <input
                          type="number"
                          step="0.01"
                          value={row.promotionalPrice ?? 0}
                          onChange={(event) =>
                            patchRow(row.id, {
                              promotionalPrice: Number(event.target.value) || 0,
                            })
                          }
                          className="w-28 px-2 py-1 border rounded"
                        />
                      ) : null}
                    </div>
                  ) : row.isPromotional ? (
                    <span>
                      {row.promotionalPrice !== null
                        ? fmt(row.promotionalPrice)
                        : "Yes"}
                    </span>
                  ) : (
                    "No"
                  )}
                </td>
                <td className="px-3 py-2">
                  <SinkImageUploader
                    sinkId={row.id}
                    imageUrl={row.imageUrl}
                    onUploaded={(imageUrl) => patchRow(row.id, { imageUrl })}
                    onRemoved={() => patchRow(row.id, { imageUrl: null })}
                  />
                </td>
                {isEditing ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) =>
                          prev.map((item) =>
                            item.id === row.id
                              ? { ...item, _deleted: true, _dirty: true }
                              : item,
                          ),
                        )
                      }
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-8 text-center text-gray-500"
                  colSpan={isEditing ? 10 : 9}
                >
                  No sinks found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
