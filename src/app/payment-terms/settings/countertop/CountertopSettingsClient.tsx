"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, Save, Trash2, Upload } from "lucide-react";
import {
  COUNTERTOP_IMAGE_OPTIONS_BY_CATEGORY,
  type CountertopImageCategory,
} from "@/lib/countertopAgreementOptions";

type ImageRow = {
  id: string;
  category: CountertopImageCategory;
  optionKey: string;
  optionLabel: string;
  imageUrl: string | null;
};

type Status = {
  kind: "success" | "error";
  message: string;
};

const SECTION_TITLE: Record<CountertopImageCategory, string> = {
  sink: "Sink Images",
  thickness: "Thickness Images",
  edge: "Edge Profile Images",
};

export default function CountertopSettingsClient() {
  const [rows, setRows] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [templateLaborChargeEnabled, setTemplateLaborChargeEnabled] =
    useState(false);
  const [flagLoading, setFlagLoading] = useState(true);
  const [flagSaving, setFlagSaving] = useState(false);
  const [flagStatus, setFlagStatus] = useState<Status | null>(null);

  useEffect(() => {
    async function loadFlag() {
      setFlagLoading(true);
      try {
        const response = await fetch("/api/payment-terms/settings", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load settings");
        }
        setTemplateLaborChargeEnabled(
          Boolean(data?.templateLaborChargeEnabled),
        );
      } catch (error: any) {
        setFlagStatus({
          kind: "error",
          message:
            error?.message || "Failed to load Payment Term settings.",
        });
      } finally {
        setFlagLoading(false);
      }
    }

    void loadFlag();
  }, []);

  async function handleToggleTemplateLaborCharge(next: boolean) {
    const previous = templateLaborChargeEnabled;
    setTemplateLaborChargeEnabled(next);
    setFlagSaving(true);
    setFlagStatus(null);

    try {
      const response = await fetch("/api/payment-terms/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateLaborChargeEnabled: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update setting");
      }
      setFlagStatus({
        kind: "success",
        message: next
          ? "New Payment Terms will now use the new calculation."
          : "New Payment Terms will use the original calculation again.",
      });
    } catch (error: any) {
      setTemplateLaborChargeEnabled(previous);
      setFlagStatus({
        kind: "error",
        message: error?.message || "Failed to update setting.",
      });
    } finally {
      setFlagSaving(false);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setStatus(null);
      try {
        const response = await fetch("/api/payment-terms/countertop-images", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load settings");
        }
        setRows(Array.isArray(data?.items) ? data.items : []);
      } catch (error: any) {
        setStatus({
          kind: "error",
          message:
            error?.message || "Failed to load countertop image settings.",
        });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const rowByKey = useMemo(() => {
    const map = new Map<string, ImageRow>();
    for (const row of rows) {
      map.set(`${row.category}:${row.optionKey}`, row);
    }
    return map;
  }, [rows]);

  async function upsertImage(
    category: CountertopImageCategory,
    optionKey: string,
    optionLabel: string,
    imageUrl: string,
  ) {
    const response = await fetch("/api/payment-terms/countertop-images", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        optionKey,
        optionLabel,
        imageUrl,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "Failed to save image");
    }

    const nextRow = data?.item as ImageRow;
    setRows((prev) => {
      const filtered = prev.filter(
        (item) => !(item.category === category && item.optionKey === optionKey),
      );
      return [...filtered, nextRow];
    });
  }

  async function handleUpload(
    category: CountertopImageCategory,
    optionKey: string,
    optionLabel: string,
    file: File,
  ) {
    const key = `${category}:${optionKey}`;
    setBusyKey(key);
    setStatus(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      form.append("optionKey", optionKey);

      const uploadResponse = await fetch(
        "/api/payment-terms/countertop-images/upload",
        {
          method: "POST",
          body: form,
        },
      );
      const uploadData = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error || "Failed to upload image");
      }

      await upsertImage(category, optionKey, optionLabel, uploadData.imageUrl);

      setStatus({ kind: "success", message: `${optionLabel} image saved.` });
    } catch (error: any) {
      setStatus({
        kind: "error",
        message: error?.message || "Failed to upload image.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemove(
    category: CountertopImageCategory,
    optionKey: string,
  ) {
    const key = `${category}:${optionKey}`;
    setBusyKey(key);
    setStatus(null);

    try {
      const response = await fetch("/api/payment-terms/countertop-images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, optionKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to remove image");
      }

      setRows((prev) =>
        prev.filter(
          (item) =>
            !(item.category === category && item.optionKey === optionKey),
        ),
      );
      setStatus({ kind: "success", message: "Image removed." });
    } catch (error: any) {
      setStatus({
        kind: "error",
        message: error?.message || "Failed to remove image.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Countertop Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload and manage images used by Countertop Agreement details pages.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Use New Payment Term Calculation
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Testing-only toggle for the new billing layout (adds a &quot;Cab.
              Installed for Template&quot; column: 80% of the cabinet
              install/removal/others balance collected at template). While
              off, new Payment Terms print exactly like they always have.
              Already-saved Payment Terms are never affected either way. This
              toggle will be removed once the new calculation is finalized.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 shrink-0 pt-1">
            <input
              type="checkbox"
              checked={templateLaborChargeEnabled}
              disabled={flagLoading || flagSaving}
              onChange={(event) =>
                void handleToggleTemplateLaborCharge(event.target.checked)
              }
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">
              {flagSaving
                ? "Saving..."
                : templateLaborChargeEnabled
                  ? "Enabled"
                  : "Disabled"}
            </span>
          </label>
        </div>
        {flagStatus ? (
          <div
            className={`mt-3 rounded-lg px-3 py-1.5 text-xs ${
              flagStatus.kind === "success"
                ? "border border-green-300 bg-green-50 text-green-700"
                : "border border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {flagStatus.message}
          </div>
        ) : null}
      </div>

      {status ? (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            status.kind === "success"
              ? "border border-green-300 bg-green-50 text-green-700"
              : "border border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading countertop image settings...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {(
            Object.keys(
              COUNTERTOP_IMAGE_OPTIONS_BY_CATEGORY,
            ) as CountertopImageCategory[]
          ).map((category) => (
            <section
              key={category}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {SECTION_TITLE[category]}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {COUNTERTOP_IMAGE_OPTIONS_BY_CATEGORY[category].map(
                  (option) => {
                    const key = `${category}:${option.optionKey}`;
                    const existing = rowByKey.get(key);
                    const isBusy = busyKey === key;

                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-gray-200 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {option.optionLabel}
                            </div>
                            <div className="text-xs text-gray-500">
                              {option.optionKey}
                            </div>
                          </div>
                          <Save className="w-4 h-4 text-gray-400" />
                        </div>

                        <div className="h-28 rounded-md border border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center">
                          {existing?.imageUrl ? (
                            <img
                              src={existing.imageUrl}
                              alt={option.optionLabel}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4" />
                              No image uploaded
                            </div>
                          )}
                        </div>

                        <input
                          ref={(el) => {
                            fileInputRefs.current[key] = el;
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            void handleUpload(
                              category,
                              option.optionKey,
                              option.optionLabel,
                              file,
                            );
                            event.currentTarget.value = "";
                          }}
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => fileInputRefs.current[key]?.click()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            {existing?.imageUrl ? "Replace" : "Upload"}
                          </button>

                          <button
                            type="button"
                            disabled={!existing?.imageUrl || isBusy}
                            onClick={() =>
                              void handleRemove(category, option.optionKey)
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
