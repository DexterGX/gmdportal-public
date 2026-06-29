"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuoteRepairStatus } from "@prisma/client";
import { Plus, Save } from "lucide-react";
import { QUOTE_REPAIR_STATUS_LABELS, formatQuoteRepairAreas } from "@/lib/quoteRepairs";

const DEFAULT_LINE_ITEMS = 22;

type VersionFormRow = {
  id: string;
  serviceId: string;
  serviceNameSnapshot: string;
  description: string;
  price: string;
};

function buildRowsFromVersion(version: any | null): VersionFormRow[] {
  const rows: VersionFormRow[] = [];
  const sourceItems = Array.isArray(version?.items) ? version.items : [];

  sourceItems.forEach((item: any, index: number) => {
    rows.push({
      id: item.id || `row-${index + 1}`,
      serviceId: item.serviceId || "",
      serviceNameSnapshot: item.serviceNameSnapshot || "",
      description: item.description || "",
      price: item.price !== null && item.price !== undefined ? String(item.price) : "",
    });
  });

  while (rows.length < DEFAULT_LINE_ITEMS) {
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

export default function QuoteRepairDetailClient({
  repair,
  services,
  userId,
  userRole,
}: {
  repair: any;
  services: Array<{ id: string; name: string }>;
  userId: string;
  userRole: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);

  const currentVersion = repair.currentVersion || repair.versions[0] || null;
  const [selectedVersionId, setSelectedVersionId] = useState<string>(currentVersion?.id || "");
  const selectedVersion = repair.versions.find((entry: any) => entry.id === selectedVersionId) || currentVersion;

  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [rows, setRows] = useState<VersionFormRow[]>([]);
  const [isVersionFormOpen, setIsVersionFormOpen] = useState(false);

  const canEditRepair = userRole === "admin" || (userRole === "sales" && (repair.salesRepId === userId || repair.createdById === userId));
  const canEditSelectedVersion = canEditRepair && selectedVersion?.id === repair.currentVersion?.id && selectedVersion?.status === "DRAFT";

  useEffect(() => {
    setCustomerNotes(selectedVersion?.customerNotes || "");
    setInternalNotes(selectedVersion?.internalNotes || "");
    setRows(buildRowsFromVersion(selectedVersion));
  }, [selectedVersionId, selectedVersion]);

  const updateStatus = async (endpoint: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/quote-repairs/${repair.id}/${endpoint}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      router.refresh();
    } catch (error: any) {
      window.alert(error?.message || "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const createNewVersion = async () => {
    setCreatingVersion(true);
    try {
      const response = await fetch(`/api/quote-repairs/${repair.id}/versions`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create version");
      setSelectedVersionId(data.id);
      setIsVersionFormOpen(true);
      router.refresh();
    } catch (error: any) {
      window.alert(error?.message || "Failed to create version");
    } finally {
      setCreatingVersion(false);
    }
  };

  const saveSelectedVersion = async () => {
    if (!selectedVersion?.id) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/quote-repairs/${repair.id}/versions/${selectedVersion.id}`, {
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
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save version");
      router.refresh();
      window.alert("Version saved.");
    } catch (error: any) {
      window.alert(error?.message || "Failed to save version");
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (index: number, next: Partial<VersionFormRow>) => {
    setRows((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], ...next };
      return clone;
    });
  };

  const versionTotal = useMemo(() => {
    return rows.reduce((sum, row) => sum + (Number(row.price || 0) || 0), 0);
  }, [rows]);

  const openSelectedVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    setIsVersionFormOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/quote-repairs" className="text-blue-600 hover:text-blue-700 text-sm">← Back to Quote Repairs</Link>
          <h1 className="text-3xl font-bold mt-2">{repair.quoteRepairNumber}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{repair.customerName} • {formatQuoteRepairAreas(repair.areas)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isVersionFormOpen && (
            <button
              type="button"
              onClick={() => setIsVersionFormOpen(true)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700"
            >
              Open Current Version
            </button>
          )}
          {isVersionFormOpen && (
            <button
              type="button"
              onClick={() => setIsVersionFormOpen(false)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700"
            >
              Hide Version Form
            </button>
          )}
          {canEditRepair && (
            <button disabled={creatingVersion} onClick={createNewVersion} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white">
              <Plus className="w-4 h-4" />
              {creatingVersion ? "Creating..." : "New Version"}
            </button>
          )}
          {canEditSelectedVersion && (
            <button disabled={saving} onClick={saveSelectedVersion} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Version"}
            </button>
          )}
          {canEditRepair && selectedVersion?.id === repair.currentVersion?.id && selectedVersion?.status === "DRAFT" && (
            <button disabled={saving} onClick={() => updateStatus("submit")} className="px-3 py-2 rounded-md bg-blue-600 text-white">Submit</button>
          )}
          {userRole === "admin" && selectedVersion?.id === repair.currentVersion?.id && selectedVersion?.status === "SUBMITTED" && (
            <>
              <button disabled={saving} onClick={() => updateStatus("approve")} className="px-3 py-2 rounded-md bg-green-600 text-white">Approve</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2">
          <p><span className="font-semibold">Address:</span> {repair.propertyAddress}</p>
          <p><span className="font-semibold">Sales Rep:</span> {repair.salesRep?.name || repair.salesRep?.email || "-"}</p>
          <p><span className="font-semibold">Status:</span> {QUOTE_REPAIR_STATUS_LABELS[repair.status as QuoteRepairStatus]}</p>
          <p><span className="font-semibold">QR #:</span> {repair.quoteRepairNumber}</p>
          <p><span className="font-semibold">Created by:</span> {repair.createdBy?.name || repair.createdBy?.email || "-"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2">
          <p><span className="font-semibold">Version #:</span> {selectedVersion?.versionNumber || "-"}</p>
          <p><span className="font-semibold">Current Version:</span> {repair.currentVersion?.versionNumber || "-"}</p>
          <p><span className="font-semibold">Approved Version:</span> {repair.approvedVersion?.versionNumber || "-"}</p>
          <p><span className="font-semibold">Created:</span> {new Date(repair.createdAt).toLocaleString()}</p>
          <p><span className="font-semibold">Updated:</span> {new Date(repair.updatedAt).toLocaleString()}</p>
        </div>
      </div>

      {isVersionFormOpen && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 font-semibold">Quote Repair Version Form</div>
          <div className="p-5 space-y-4">
            {!canEditSelectedVersion && (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
                Viewing a locked version. To edit, create a new version or open the current draft version.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left w-14">#</th>
                    <th className="px-3 py-2 text-left w-56">Service</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left w-40">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={row.serviceId}
                          disabled={!canEditSelectedVersion}
                          onChange={(event) => {
                            const value = event.target.value;
                            const selectedService = services.find((service) => service.id === value);
                            updateRow(index, {
                              serviceId: value,
                              serviceNameSnapshot: selectedService?.name || "",
                            });
                          }}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                        >
                          <option value="">Select service</option>
                          {services.map((service) => (
                            <option key={service.id} value={service.id}>{service.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.description}
                          disabled={!canEditSelectedVersion}
                          onChange={(event) => updateRow(index, { description: event.target.value })}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={row.price}
                          disabled={!canEditSelectedVersion}
                          onChange={(event) => updateRow(index, { price: event.target.value })}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-900 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                    <td className="px-3 py-2">${versionTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Customer Notes</label>
                <textarea
                  rows={4}
                  value={customerNotes}
                  disabled={!canEditSelectedVersion}
                  onChange={(event) => setCustomerNotes(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Internal Notes</label>
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
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 font-semibold">Version History</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {['Version','Status','Created By','Created','Updated By','Submitted','Approved By','Approved','Total','Actions'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {repair.versions.map((version: any) => (
                <tr key={version.id} className={version.id === selectedVersion?.id ? "bg-blue-50/70 dark:bg-blue-950/20" : ""}>
                  <td className="px-4 py-3 font-medium">
                    <button onClick={() => openSelectedVersion(version.id)} className="text-blue-700 hover:text-blue-800">{version.versionNumber}</button>
                  </td>
                  <td className="px-4 py-3">{QUOTE_REPAIR_STATUS_LABELS[version.status as QuoteRepairStatus]}</td>
                  <td className="px-4 py-3">{version.createdBy?.name || version.createdBy?.email || '-'}</td>
                  <td className="px-4 py-3">{new Date(version.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{version.updatedBy?.name || version.updatedBy?.email || '-'}</td>
                  <td className="px-4 py-3">{version.submittedAt ? new Date(version.submittedAt).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">{version.approvedBy?.name || version.approvedBy?.email || '-'}</td>
                  <td className="px-4 py-3">{version.approvedAt ? new Date(version.approvedAt).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">${Number(version.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openSelectedVersion(version.id)} className="text-blue-600 hover:text-blue-700">Open</button>
                      <Link href={`/quote-repairs/print/${version.id}`} className="text-blue-600 hover:text-blue-700">Print</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold mb-3">Activity</h2>
        <div className="space-y-2 text-sm">
          {repair.activities.map((entry: any) => (
            <div key={entry.id} className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-2">
              <div>
                <div className="font-medium">{entry.action}</div>
                <div className="text-gray-500">{entry.actor?.name || entry.actor?.email || '-'}</div>
              </div>
              <div className="text-gray-500 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
