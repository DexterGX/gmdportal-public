"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Pencil,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import {
  QUOTE_REPAIR_STATUS_LABELS,
  formatQuoteRepairAreas,
  formatUsPhone,
  formatUsd,
  normalizeQuoteRepairDisplayStatus,
} from "@/lib/quoteRepairs";

type QuoteRepairStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "VOIDED"
  | "ARCHIVED";

const MIN_ROWS = 5;

type VersionFormRow = {
  id: string;
  serviceId: string;
  serviceNameSnapshot: string;
  description: string;
  price: string;
};

function buildRowsFromVersion(version: any | null): VersionFormRow[] {
  const sourceItems = Array.isArray(version?.items) ? version.items : [];
  const rows: VersionFormRow[] = sourceItems.map(
    (item: any, index: number) => ({
      id: item.id || `row-${index + 1}`,
      serviceId: item.serviceId || "",
      serviceNameSnapshot: item.serviceNameSnapshot || "",
      description: item.description || "",
      price:
        item.price !== null && item.price !== undefined
          ? String(item.price)
          : "",
    }),
  );

  while (rows.length < MIN_ROWS) {
    rows.push({
      id: `empty-${rows.length + 1}`,
      serviceId: "",
      serviceNameSnapshot: "",
      description: "",
      price: "",
    });
  }

  return rows;
}

function normalizePriceInput(value: string) {
  return value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
}

function parsePriceToNumber(value: string) {
  const parsed = Number((value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPriceInput(value: string) {
  const cleaned = normalizePriceInput(value);
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return cleaned;
  }

  const isNegative = cleaned.startsWith("-");
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;
  const [integerRaw, decimalRaw] = unsigned.split(".");
  const integerDigits = integerRaw.replace(/\D/g, "") || "0";
  const integerWithCommas = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimalDigits = (decimalRaw || "").replace(/\D/g, "").slice(0, 2);
  const sign = isNegative ? "-" : "";

  if (unsigned.endsWith(".") && decimalDigits.length === 0) {
    return `${sign}${integerWithCommas}.`;
  }

  return decimalDigits.length > 0
    ? `${sign}${integerWithCommas}.${decimalDigits}`
    : `${sign}${integerWithCommas}`;
}

function statusBadgeClass(status: QuoteRepairStatus) {
  if (normalizeQuoteRepairDisplayStatus(status) === "APPROVED") {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
}

export default function QuoteRepairVersionClient({
  repair,
  versionId,
  services,
  userId,
  userRole,
}: {
  repair: any;
  versionId: string;
  services: Array<{ id: string; name: string }>;
  userId: string;
  userRole: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") || "view";

  const selectedVersion =
    repair.versions.find((entry: any) => entry.id === versionId) ||
    repair.currentVersion ||
    repair.versions[0] ||
    null;

  const [rows, setRows] = useState<VersionFormRow[]>(
    buildRowsFromVersion(selectedVersion),
  );
  const [customerNotes, setCustomerNotes] = useState(
    selectedVersion?.customerNotes || "",
  );
  const [internalNotes, setInternalNotes] = useState(
    selectedVersion?.internalNotes || "",
  );
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const canEditRepair =
    userRole === "admin" ||
    (userRole === "sales" &&
      (repair.salesRepId === userId || repair.createdById === userId));
  const canEditSelectedVersion =
    canEditRepair &&
    initialMode === "edit" &&
    selectedVersion?.id === repair.currentVersion?.id &&
    selectedVersion?.status === "DRAFT";
  const canApproveSelectedVersion =
    userRole === "admin" &&
    selectedVersion?.id === repair.currentVersion?.id &&
    selectedVersion?.status !== "APPROVED";

  useEffect(() => {
    setRows(buildRowsFromVersion(selectedVersion));
    setCustomerNotes(selectedVersion?.customerNotes || "");
    setInternalNotes(selectedVersion?.internalNotes || "");
  }, [selectedVersion?.id, selectedVersion]);

  const versionTotal = useMemo(() => {
    return rows.reduce(
      (sum, row) => sum + parsePriceToNumber(row.price || ""),
      0,
    );
  }, [rows]);

  const updateRow = (index: number, next: Partial<VersionFormRow>) => {
    setRows((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], ...next };
      return clone;
    });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `added-${Date.now()}-${prev.length + 1}`,
        serviceId: "",
        serviceNameSnapshot: "",
        description: "",
        price: "",
      },
    ]);
  };

  const deleteRow = (index: number) => {
    setRows((prev) => {
      if (prev.length <= MIN_ROWS) {
        const next = [...prev];
        next[index] = {
          ...next[index],
          serviceId: "",
          serviceNameSnapshot: "",
          description: "",
          price: "",
        };
        return next;
      }

      return prev.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const saveSelectedVersion = async () => {
    if (!selectedVersion?.id || !canEditSelectedVersion) return false;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/quote-repairs/${repair.id}/versions/${selectedVersion.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerNotes,
            internalNotes,
            items: rows.map((row) => ({
              serviceId: row.serviceId || null,
              serviceNameSnapshot: row.serviceNameSnapshot,
              description: row.description,
              price: row.price,
            })),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save version");
      window.alert("Version saved.");
      router.refresh();
      return true;
    } catch (error: any) {
      window.alert(error?.message || "Failed to save version");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveThenApprove = async () => {
    if (!selectedVersion?.id || !canApproveSelectedVersion) return;

    setApproving(true);
    try {
      const response = await fetch(`/api/quote-repairs/${repair.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerNotes,
          internalNotes,
          items: rows.map((row) => ({
            serviceId: row.serviceId || null,
            serviceNameSnapshot: row.serviceNameSnapshot,
            description: row.description,
            price: row.price,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Failed to approve version");
      router.refresh();
    } catch (error: any) {
      window.alert(error?.message || "Failed to approve version");
    } finally {
      setApproving(false);
    }
  };

  const createNewVersion = async () => {
    try {
      const response = await fetch(`/api/quote-repairs/${repair.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceVersionId: selectedVersion.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Failed to create version");
      router.push(`/quote-repairs/${repair.id}/versions/${data.id}?mode=edit`);
      router.refresh();
    } catch (error: any) {
      window.alert(error?.message || "Failed to create version");
    }
  };

  if (!selectedVersion) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-sm text-red-600">Version not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/quote-repairs/${repair.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ← Back to Quote Repair
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            {repair.quoteRepairNumber} • Version {selectedVersion.versionNumber}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {repair.customerName} • {formatQuoteRepairAreas(repair.areas)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={createNewVersion}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Pencil className="w-4 h-4" />
            Edit As New Version
          </button>
          <Link
            href={`/quote-repairs/print/${selectedVersion.id}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Printer className="w-4 h-4" />
            Print
          </Link>
          {canApproveSelectedVersion && (
            <button
              type="button"
              disabled={approving}
              onClick={saveThenApprove}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {approving ? "Approving..." : "Approve"}
            </button>
          )}
          {canEditSelectedVersion && (
            <button
              type="button"
              disabled={saving}
              onClick={saveSelectedVersion}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Draft"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2">
          <h2 className="font-semibold text-lg">Job Information</h2>
          <p>
            <span className="font-semibold">Client Name:</span>{" "}
            {repair.customerName}
          </p>
          <p>
            <span className="font-semibold">Address:</span>{" "}
            {repair.propertyAddress}
          </p>
          <p>
            <span className="font-semibold">Phone:</span>{" "}
            {formatUsPhone(repair.customerPhone) || "-"}
          </p>
          <p>
            <span className="font-semibold">Contractor:</span>{" "}
            {repair.contractor || "-"}
          </p>
          <p>
            <span className="font-semibold">Areas:</span>{" "}
            {formatQuoteRepairAreas(repair.areas)}
          </p>
          <p>
            <span className="font-semibold">Sales Rep:</span>{" "}
            {repair.salesRep?.name || repair.salesRep?.email || "-"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2">
          <h2 className="font-semibold text-lg">Quote Information</h2>
          <p>
            <span className="font-semibold">QR Estimate #:</span>{" "}
            {repair.quoteRepairNumber}
          </p>
          <p>
            <span className="font-semibold">Version #:</span>{" "}
            {selectedVersion.versionNumber}
          </p>
          <p>
            <span className="font-semibold">Created:</span>{" "}
            {new Date(selectedVersion.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">Updated:</span>{" "}
            {new Date(selectedVersion.updatedAt).toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">Approved Version:</span>{" "}
            {repair.approvedVersion?.versionNumber || "-"}
          </p>
          <div>
            <span className="font-semibold">Status:</span>{" "}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(selectedVersion.status as QuoteRepairStatus)}`}
            >
              {
                QUOTE_REPAIR_STATUS_LABELS[
                  normalizeQuoteRepairDisplayStatus(
                    selectedVersion.status as QuoteRepairStatus,
                  )
                ]
              }
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 font-semibold">
          Quote Repair Version
        </div>
        <div className="p-5 space-y-4">
          {!canEditSelectedVersion && (
            <div className="rounded-md border border-blue-200 bg-blue-50 text-blue-900 px-3 py-2 text-sm">
              Viewing state enabled. Use Edit As New Version to make changes.
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-600">
            <table className="w-full min-w-[980px] text-sm border-collapse">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-3 py-2 text-left w-14 border border-blue-800">
                    #
                  </th>
                  <th className="px-3 py-2 text-left w-14 border border-blue-800">
                    Del
                  </th>
                  <th className="px-3 py-2 text-left w-56 border border-blue-800">
                    Service
                  </th>
                  <th className="px-3 py-2 text-left border border-blue-800">
                    Description
                  </th>
                  <th className="px-3 py-2 text-left w-48 border border-blue-800">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="bg-white dark:bg-gray-900">
                    <td className="px-3 py-2 text-gray-500 border border-gray-300 dark:border-gray-600 align-top">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 dark:border-gray-600 align-top">
                      {canEditSelectedVersion ? (
                        <button
                          type="button"
                          onClick={() => deleteRow(index)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-100 text-red-700 hover:bg-red-200"
                          aria-label={`Delete row ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 dark:border-gray-600 align-top">
                      {canEditSelectedVersion ? (
                        <select
                          value={row.serviceId}
                          onChange={(event) => {
                            const value = event.target.value;
                            const selectedService = services.find(
                              (service) => service.id === value,
                            );
                            updateRow(index, {
                              serviceId: value,
                              serviceNameSnapshot: selectedService?.name || "",
                            });
                          }}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                        >
                          <option value="">Select service</option>
                          {services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="py-1">
                          {row.serviceNameSnapshot || "-"}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 dark:border-gray-600 align-top">
                      {canEditSelectedVersion ? (
                        <textarea
                          value={row.description}
                          onChange={(event) => {
                            updateRow(index, {
                              description: event.target.value,
                            });
                            event.currentTarget.style.height = "auto";
                            event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                          }}
                          rows={1}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 resize-none overflow-hidden"
                        />
                      ) : (
                        <div className="py-1 whitespace-pre-wrap break-words">
                          {row.description || "-"}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 dark:border-gray-600 align-top">
                      {canEditSelectedVersion ? (
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.price}
                            onChange={(event) =>
                              updateRow(index, {
                                price: formatPriceInput(event.target.value),
                              })
                            }
                            onBlur={() => {
                              if (!row.price.trim()) {
                                updateRow(index, { price: "" });
                                return;
                              }
                              updateRow(index, {
                                price: formatPriceInput(
                                  parsePriceToNumber(row.price).toFixed(2),
                                ),
                              });
                            }}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-6 pr-2 py-1"
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <div className="py-1">
                          {formatUsd(parsePriceToNumber(row.price || "0"))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900 font-semibold">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-right border border-gray-300 dark:border-gray-600"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2 border border-gray-300 dark:border-gray-600">
                    {formatUsd(versionTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {canEditSelectedVersion && (
            <div>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <Plus className="w-4 h-4" />
                Add Row
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Customer Notes
              </label>
              <textarea
                rows={4}
                value={customerNotes}
                disabled={!canEditSelectedVersion}
                onChange={(event) => setCustomerNotes(event.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Internal Notes
              </label>
              <textarea
                rows={4}
                value={internalNotes}
                disabled={!canEditSelectedVersion}
                onChange={(event) => setInternalNotes(event.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
