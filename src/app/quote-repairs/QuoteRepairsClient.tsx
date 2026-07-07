"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Eye, RefreshCw, X, Trash2 } from "lucide-react";
import type { QuoteRepairStatus } from "@prisma/client";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import {
  QUOTE_REPAIR_STATUS_LABELS,
  formatQuoteRepairAreas,
} from "@/lib/quoteRepairs";

type SalesUser = { id: string; name: string | null; email: string | null };

type QuoteRepairRow = {
  id: string;
  quoteRepairNumber: string;
  customerName: string;
  propertyAddress: string;
  status: QuoteRepairStatus;
  currentVersionNumber: number | null;
  approvedVersionNumber: number | null;
  total: string;
  createdAt: string;
  updatedAt: string;
  salesRep: SalesUser | null;
  areas: string[];
  versions: Array<{
    id: string;
    versionNumber: number;
    status: QuoteRepairStatus;
    total: string;
  }>;
};

type QuoteRepairListResponse = {
  rows: QuoteRepairRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
const LIST_STATUS_OPTIONS: QuoteRepairStatus[] = ["DRAFT", "APPROVED"];

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: string | number) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return CURRENCY_FORMATTER.format(0);
  return CURRENCY_FORMATTER.format(numeric);
}

function toDisplayStatus(status: QuoteRepairStatus): QuoteRepairStatus {
  return status === "APPROVED" ? "APPROVED" : "DRAFT";
}

function getStatusPillClass(status: QuoteRepairStatus) {
  if (status === "APPROVED") {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
}

function formatPhoneNumber(raw: string | null | undefined) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw || "";
}

export default function QuoteRepairsClient({
  userId,
  userRole,
  userName,
  salesUsers,
}: {
  userId: string;
  userRole: string;
  userName: string;
  salesUsers: SalesUser[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<QuoteRepairRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [customerSearch, setCustomerSearch] = useState(
    searchParams.get("customer") || "",
  );
  const [qrSearch, setQrSearch] = useState(searchParams.get("qr") || "");
  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    const current = searchParams.get("status") || "";
    return current ? current.split(",").filter(Boolean) : [];
  });
  const [salesRepFilter, setSalesRepFilter] = useState<string[]>(() => {
    const current = searchParams.get("salesRep") || "";
    return current ? current.split(",").filter(Boolean) : [];
  });

  const salesRepOptions = useMemo(
    () => salesUsers.map((entry) => entry.name || entry.email || entry.id),
    [salesUsers],
  );

  const statusOptions = useMemo(() => LIST_STATUS_OPTIONS, []);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRows = async (nextPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (customerSearch.trim()) params.set("customer", customerSearch.trim());
      if (qrSearch.trim()) params.set("qr", qrSearch.trim());
      if (statusFilter.length) params.set("status", statusFilter.join(","));
      if (salesRepFilter.length)
        params.set("salesRep", salesRepFilter.join(","));
      params.set("page", String(nextPage));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));

      const response = await fetch(`/api/quote-repairs?${params.toString()}`);
      const data = (await response.json()) as QuoteRepairListResponse & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Failed to load quote repairs");
      setRows(data.rows);
      setTotal(data.total);
      setPage(data.page);
    } catch (err: any) {
      setError(err?.message || "Failed to load quote repairs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchRows(1);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearch, qrSearch, statusFilter, salesRepFilter]);

  const resetFilters = () => {
    setCustomerSearch("");
    setQrSearch("");
    setStatusFilter([]);
    setSalesRepFilter([]);
  };

  const canCreate = ["admin", "sales"].includes(userRole);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  const deleteRepair = async (id: string, quoteRepairNumber: string) => {
    const confirmed = window.confirm(
      `Delete ${quoteRepairNumber}? This action can be undone only by re-creating the quote repair.`,
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/quote-repairs/${id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete quote repair");
      }
      await fetchRows(page);
    } catch (err: any) {
      window.alert(err?.message || "Failed to delete quote repair");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Quote Repairs
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track quote repair jobs, versions, review, and approvals.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Quote Repair
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Customer Name"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={qrSearch}
            onChange={(e) => setQrSearch(e.target.value)}
            placeholder="QR #"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <FilterMultiSelect
          label="Sales Rep"
          options={salesRepOptions}
          selected={salesRepFilter}
          onChange={setSalesRepFilter}
          fullWidth
          matchInputStyle
        />
        <FilterMultiSelect
          label="Status"
          options={statusOptions}
          selected={statusFilter}
          onChange={setStatusFilter}
          fullWidth
          matchInputStyle
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Filters
        </button>
        <span className="text-sm text-gray-500">
          {loading ? "Loading..." : `${total} record${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-4">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-sm text-gray-500">
          Loading quote repairs...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center text-sm text-gray-500">
          No quote repairs match your filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {row.quoteRepairNumber}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {row.customerName}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusPillClass(toDisplayStatus(row.status))}`}
                  >
                    {QUOTE_REPAIR_STATUS_LABELS[toDisplayStatus(row.status)]}
                  </span>
                </div>

                <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <p>
                    <span className="font-semibold">Address:</span>{" "}
                    {row.propertyAddress}
                  </p>
                  <p>
                    <span className="font-semibold">Areas:</span>{" "}
                    {formatQuoteRepairAreas(row.areas)}
                  </p>
                  <p>
                    <span className="font-semibold">Sales Rep:</span>{" "}
                    {row.salesRep?.name || row.salesRep?.email || "-"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    <p className="font-semibold">Version</p>
                    <p>{row.currentVersionNumber ?? "-"}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Total</p>
                    <p>{formatCurrency(row.total)}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Created</p>
                    <p>{new Date(row.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/quote-repairs/${row.id}`)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-100 text-blue-700 px-3 py-2 hover:bg-blue-200"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                  {userRole === "admin" && (
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() =>
                        deleteRepair(row.id, row.quoteRepairNumber)
                      }
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-red-100 text-red-700 px-3 py-2 hover:bg-red-200 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === row.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {[
                    "QR #",
                    "Customer",
                    "Address",
                    "Areas",
                    "Sales Rep",
                    "Current Version",
                    "Status",
                    "Total",
                    "Created",
                    "Actions",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    <td className="px-4 py-4 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {row.quoteRepairNumber}
                    </td>
                    <td className="px-4 py-4 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {row.customerName}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {row.propertyAddress}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {formatQuoteRepairAreas(row.areas)}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {row.salesRep?.name || row.salesRep?.email || "-"}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {row.currentVersionNumber ?? "-"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusPillClass(toDisplayStatus(row.status))}`}
                      >
                        {
                          QUOTE_REPAIR_STATUS_LABELS[
                            toDisplayStatus(row.status)
                          ]
                        }
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-4 py-4 text-gray-500 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/quote-repairs/${row.id}`)
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-blue-100 text-blue-700 px-3 py-1.5 hover:bg-blue-200"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                        {userRole === "admin" && (
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() =>
                              deleteRepair(row.id, row.quoteRepairNumber)
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-red-100 text-red-700 px-3 py-1.5 hover:bg-red-200 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === row.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => fetchRows(page - 1)}
            className="px-3 py-2 rounded-md border border-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => fetchRows(page + 1)}
            className="px-3 py-2 rounded-md border border-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {showNewModal && (
        <NewQuoteRepairModal
          userId={userId}
          userName={userName}
          salesUsers={salesUsers}
          onClose={() => setShowNewModal(false)}
          onSuccess={(createdId) => {
            setShowNewModal(false);
            router.push(`/quote-repairs/${createdId}`);
          }}
        />
      )}
    </div>
  );
}

function NewQuoteRepairModal({
  userId,
  userName,
  salesUsers,
  onClose,
  onSuccess,
}: {
  userId: string;
  userName: string;
  salesUsers: SalesUser[];
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pipedrivePersonId, setPipedrivePersonId] = useState("");
  const [pipedriveDealId, setPipedriveDealId] = useState("");
  const [pipedriveDealName, setPipedriveDealName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [contractor, setContractor] = useState("");
  const [salesRepId, setSalesRepId] = useState(userId);
  const [areas, setAreas] = useState<string[]>(["MASTER"]);
  const [customArea, setCustomArea] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const isCustomerLocked = selectedCustomer !== null;

  const customerDeals = useMemo(() => {
    if (!selectedCustomer || !Array.isArray(selectedCustomer.jobs)) return [];
    return selectedCustomer.jobs as Array<{
      id: string;
      dealId?: string;
      dealName?: string;
      status?: string;
      address?: string;
    }>;
  }, [selectedCustomer]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (isCustomerLocked || customerName.trim().length < 2) {
        setCustomerResults([]);
        return;
      }

      const response = await fetch(
        `/api/quote-repairs/lookup?q=${encodeURIComponent(customerName.trim())}`,
      );
      const data = await response.json();
      setCustomerResults(Array.isArray(data.results) ? data.results : []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerName, isCustomerLocked]);

  const salesRepDisabled = userName && salesUsers.length > 0 ? false : true;

  const applySelection = (result: any) => {
    setSelectedCustomer(result);
    setCustomerName(result.displayName || "");
    setCustomerPhone(
      formatPhoneNumber(result.phone || result.customerPhone || ""),
    );
    setPipedrivePersonId(result.pipedriveId || "");
    setPropertyAddress(result.customerAddress || "");
    setContractor(result.contractor || "");
    setSelectedDeal(result.jobs?.[0] || null);
    if (result.jobs?.[0]) {
      setPipedriveDealId(result.jobs[0].dealId || "");
      setPipedriveDealName(result.jobs[0].dealName || "");
      setPropertyAddress(
        result.jobs[0].address || result.customerAddress || "",
      );
    }

    setCustomerResults([]);
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setSelectedDeal(null);
    setCustomerName("");
    setCustomerPhone("");
    setPipedrivePersonId("");
    setPipedriveDealId("");
    setPipedriveDealName("");
    setPropertyAddress("");
    setContractor("");
    setCustomerResults([]);
  };

  const handleDealSelection = (dealId: string) => {
    const nextDeal = customerDeals.find((job) => job.id === dealId) || null;
    setSelectedDeal(nextDeal);
    setPipedriveDealId(nextDeal?.dealId || "");
    setPipedriveDealName(nextDeal?.dealName || "");
    if (nextDeal?.address) {
      setPropertyAddress(nextDeal.address);
    }
  };

  const addCustomArea = () => {
    const cleaned = customArea.trim();
    if (!cleaned || areas.includes(cleaned)) return;
    setAreas((prev) => [...prev, cleaned]);
    setCustomArea("");
  };

  const toggleArea = (value: string) => {
    setAreas((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedCustomer) {
      window.alert("Please select a customer from search.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/quote-repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          pipedrivePersonId,
          pipedriveDealId,
          pipedriveDealName,
          propertyAddress,
          contractor,
          salesRepId: salesRepDisabled ? userId : salesRepId,
          areas,
          customerNotes: notes,
          selectedCustomer,
          selectedDeal,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to create quote repair");
      onSuccess(data.id);
    } catch (error: any) {
      window.alert(error?.message || "Failed to create quote repair");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-4xl rounded-2xl bg-white dark:bg-gray-900 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create New Quote Repair</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Customer Name
            </label>
            <div className="relative">
              <input
                value={customerName}
                onChange={(e) => {
                  if (isCustomerLocked) {
                    return;
                  }
                  setCustomerName(e.target.value);
                }}
                required
                readOnly={isCustomerLocked}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-10"
                placeholder="Type to search customers..."
              />
              {isCustomerLocked && (
                <button
                  type="button"
                  onClick={clearSelectedCustomer}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                  aria-label="Clear selected customer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {customerResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {customerResults.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    onClick={() => applySelection(result)}
                    className="w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="font-medium">{result.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {result.pipedriveId
                        ? `Pipedrive ID ${result.pipedriveId}`
                        : "Local customer"}
                      {result.contractor ? ` • ${result.contractor}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {isCustomerLocked && (
              <p className="mt-1 text-xs text-gray-500">
                Customer selected from search.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Customer Phone
            </label>
            <input
              value={customerPhone}
              readOnly
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Pipedrive Person ID
            </label>
            <input
              value={pipedrivePersonId}
              readOnly
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Deal (ID - Name)
            </label>
            <select
              value={selectedDeal?.id || ""}
              onChange={(event) => handleDealSelection(event.target.value)}
              disabled={!selectedCustomer || customerDeals.length === 0}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 disabled:bg-gray-100 dark:disabled:bg-gray-800"
            >
              {customerDeals.length === 0 ? (
                <option value="">No deals available for this customer</option>
              ) : (
                customerDeals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {`${deal.dealId || "No Deal ID"} - ${deal.dealName || "Unnamed Deal"} (${deal.status || "Unknown"})`}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Property Address
            </label>
            <input
              value={propertyAddress}
              readOnly
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contractor</label>
            <input
              value={contractor}
              readOnly
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Sales Representative
            </label>
            <select
              disabled={salesRepDisabled}
              value={salesRepId}
              onChange={(e) => setSalesRepId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
            >
              {salesUsers.map((salesUser) => (
                <option key={salesUser.id} value={salesUser.id}>
                  {salesUser.name || salesUser.email || salesUser.id}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Areas</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "MASTER",
                "GUEST",
                "KITCHEN",
                "WALL_UNIT",
                "GARAGE",
                "LAUNDRY",
                "OTHER",
              ].map((area) => (
                <button
                  type="button"
                  key={area}
                  onClick={() => toggleArea(area)}
                  className={`px-3 py-2 rounded-full border text-sm ${areas.includes(area) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-700"}`}
                >
                  {area}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                placeholder="Custom area"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              />
              <button
                type="button"
                onClick={addCustomArea}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
              >
                Add
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {areas.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-sm"
                >
                  {area}
                  <button
                    type="button"
                    onClick={() =>
                      setAreas((prev) => prev.filter((item) => item !== area))
                    }
                    className="text-gray-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Initial Sales Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
            />
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Quote Repair"}
          </button>
        </div>
      </form>
    </div>
  );
}
