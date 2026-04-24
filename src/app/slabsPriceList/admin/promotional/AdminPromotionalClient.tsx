"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Edit2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

const SLAB_VIEW_LICENSE = "532b5c05af7b036ff8a0200d0c8dc6da";
const buildSlabViewUrl = (scannerId: string) =>
  `https://fusiondrivecloud.com/slabview/?license=${SLAB_VIEW_LICENSE}&SlabID=${encodeURIComponent(scannerId)}`;

type BaySlab = {
  id: string;
  scannerId: string;
  name: string;
  type: "GMD" | "REMNANT";
  thickness: string;
  size: string;
  brand: string | null;
  finish: string | null;
  rackId: string | null;
};

type PromoSlab = {
  id: string;
  slabBaySlabId: string;
  price: number;
  isPriceTbd: boolean;
  status: "AVAILABLE" | "ON_HOLD" | "SOLD";
  soldToClientName: string | null;
  soldCustomerId: string | null;
  soldCustomerName: string | null;
  soldJobId: string | null;
  soldJobName: string | null;
  holdUntil: string | null;
  holdByUserName: string | null;
  holdCustomerId: string | null;
  holdCustomerName: string | null;
  holdJobId: string | null;
  holdJobName: string | null;
  scannerId: string | null;
  name: string;
  type: "GMD" | "REMNANT";
  thickness: string;
  size: string;
  brand: string | null;
  finish: string | null;
  rackId: string | null;
};

type CustomerOption = {
  id: string;
  pipedriveId: string | null;
  displayName: string;
  companyName: string | null;
};

type JobOption = {
  id: string;
  jobName: string;
  pipedriveId: string | null;
  dealTitle: string | null;
  status: string;
};

type BulkDraft = {
  selected: boolean;
  price: string;
  isPriceTbd: boolean;
};

const STATUS_LABELS: Record<PromoSlab["status"], string> = {
  AVAILABLE: "Available",
  ON_HOLD: "On Hold",
  SOLD: "Sold",
};

const STATUS_COLORS: Record<PromoSlab["status"], string> = {
  AVAILABLE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  ON_HOLD:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  SOLD: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

const normalizeCurrencyInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const decimalPart = decimalParts.join("").slice(0, 2);

  if (!normalizedInteger && !decimalPart && !cleaned.includes(".")) {
    return "";
  }

  if (cleaned.includes(".")) {
    return `${normalizedInteger || "0"}.${decimalPart}`;
  }

  return normalizedInteger || "0";
};

const formatCurrencyInput = (value: string) => {
  const normalized = normalizeCurrencyInput(value);
  if (!normalized) return "";

  const [integerPart, decimalPart] = normalized.split(".");
  const formattedInteger = Number(integerPart || "0").toLocaleString("en-US");

  if (decimalPart !== undefined) {
    return `$${formattedInteger}.${decimalPart}`;
  }

  return `$${formattedInteger}`;
};

const parseCurrencyInput = (value: string) => {
  const normalized = normalizeCurrencyInput(value);
  if (!normalized) return Number.NaN;
  return Number.parseFloat(normalized);
};

const formatCustomerOptionLabel = (customer: CustomerOption) =>
  `#${customer.pipedriveId ?? customer.id} - ${customer.displayName}`;

function StatusEditModal({
  row,
  onClose,
  onSave,
}: {
  row: PromoSlab;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [status, setStatus] = useState<PromoSlab["status"]>(row.status);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(
    row.status === "ON_HOLD"
      ? row.holdCustomerId
        ? { id: row.holdCustomerId, pipedriveId: null, displayName: row.holdCustomerName || "", companyName: null }
        : null
      : row.soldCustomerId
        ? { id: row.soldCustomerId, pipedriveId: null, displayName: row.soldCustomerName || "", companyName: null }
        : null,
  );
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(
    row.status === "ON_HOLD" ? row.holdJobId || "" : row.soldJobId || "",
  );
  const [saving, setSaving] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setShowCustomers(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setCustomers([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoadingCustomers(true);
      try {
        const res = await fetch(`/api/slabs/promotional/customer-jobs?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const payload = (await res.json()) as { customers?: CustomerOption[] };
        setCustomers(Array.isArray(payload.customers) ? payload.customers : []);
        setShowCustomers(true);
      } finally {
        setLoadingCustomers(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!selectedCustomer) {
      setJobs([]);
      setSelectedJobId("");
      return;
    }
    const loadJobs = async () => {
      setLoadingJobs(true);
      try {
        const res = await fetch(
          `/api/slabs/promotional/customer-jobs?customerId=${encodeURIComponent(selectedCustomer.id)}`,
        );
        if (!res.ok) return;
        const payload = (await res.json()) as { jobs?: JobOption[] };
        setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      } finally {
        setLoadingJobs(false);
      }
    };
    loadJobs();
  }, [selectedCustomer]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const needsCustomerAndJob = status === "ON_HOLD" || status === "SOLD";
  const canSave = needsCustomerAndJob ? Boolean(selectedCustomer && selectedJob) : true;

  const submit = async () => {
    if (!canSave) return;

    const payload: Record<string, unknown> = { status };
    if (status === "ON_HOLD" && selectedCustomer && selectedJob) {
      payload.holdCustomerId = selectedCustomer.id;
      payload.holdCustomerName = selectedCustomer.displayName;
      payload.holdJobId = selectedJob.id;
      payload.holdJobName = selectedJob.dealTitle || selectedJob.jobName;
    }
    if (status === "SOLD" && selectedCustomer && selectedJob) {
      payload.soldCustomerId = selectedCustomer.id;
      payload.soldCustomerName = selectedCustomer.displayName;
      payload.soldJobId = selectedJob.id;
      payload.soldJobName = selectedJob.dealTitle || selectedJob.jobName;
    }

    setSaving(true);
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Slab Status</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as PromoSlab["status"])}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="AVAILABLE">Available</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="SOLD">Sold</option>
          </select>
        </div>

        {needsCustomerAndJob && (
          <>
            <div ref={wrapRef} className="space-y-2 relative">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
              <input
                type="text"
                value={selectedCustomer ? formatCustomerOptionLabel(selectedCustomer) : query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (selectedCustomer) setSelectedCustomer(null);
                }}
                onFocus={() => {
                  if (customers.length > 0) setShowCustomers(true);
                }}
                placeholder="Search customer..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              {showCustomers && (
                <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow max-h-48 overflow-y-auto">
                  {loadingCustomers ? (
                    <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>
                  ) : customers.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
                  ) : (
                    customers.map((customer) => (
                      <li key={customer.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setQuery(formatCustomerOptionLabel(customer));
                            setShowCustomers(false);
                          }}
                        >
                          {formatCustomerOptionLabel(customer)}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Job / Deal</label>
              <select
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                disabled={!selectedCustomer || loadingJobs}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="">
                  {selectedCustomer ? (loadingJobs ? "Loading jobs..." : "Select job") : "Select customer first"}
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.pipedriveId ? `#${job.pipedriveId} - ` : ""}
                    {job.dealTitle || job.jobName}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={submit}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save status"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPromotionalClient() {
  const [promoRows, setPromoRows] = useState<PromoSlab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const [showBulk, setShowBulk] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkAvailable, setBulkAvailable] = useState<BaySlab[]>([]);
  const [bulkAlreadyAdded, setBulkAlreadyAdded] = useState<PromoSlab[]>([]);
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, BulkDraft>>({});

  const [statusTarget, setStatusTarget] = useState<PromoSlab | null>(null);

  const fetchPromo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/slabs/promotional", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as PromoSlab[];
      setPromoRows(Array.isArray(payload) ? payload : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromo();
  }, []);

  const loadBulkData = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/slabs/promotional/bay-slabs?grouped=true", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as {
        available?: BaySlab[];
        alreadyAdded?: PromoSlab[];
      };
      const available = Array.isArray(payload.available) ? payload.available : [];
      const alreadyAdded = Array.isArray(payload.alreadyAdded) ? payload.alreadyAdded : [];
      setBulkAvailable(available);
      setBulkAlreadyAdded(alreadyAdded);
      setBulkDrafts(
        available.reduce<Record<string, BulkDraft>>((acc, slab) => {
          acc[slab.id] = {
            selected: false,
            price: "",
            isPriceTbd: false,
          };
          return acc;
        }, {}),
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promoRows;
    return promoRows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.slabBaySlabId.toLowerCase().includes(q) ||
        (row.brand ?? "").toLowerCase().includes(q),
    );
  }, [promoRows, search]);

  const filteredBulkAvailable = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    if (!q) return bulkAvailable;
    return bulkAvailable.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        (row.brand ?? "").toLowerCase().includes(q),
    );
  }, [bulkAvailable, bulkSearch]);

  const selectedBulkIds = useMemo(
    () => Object.entries(bulkDrafts).filter(([, draft]) => draft.selected).map(([id]) => id),
    [bulkDrafts],
  );

  const handleSavePrice = async (row: PromoSlab) => {
    const priceNum = parseCurrencyInput(editPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      window.alert("Please enter a valid non-negative price.");
      return;
    }
    await fetch(`/api/slabs/promotional/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: priceNum, isPriceTbd: false }),
    });
    setEditingId(null);
    await fetchPromo();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove \"${name}\" from the promotional list?`)) return;
    await fetch(`/api/slabs/promotional/${id}`, { method: "DELETE" });
    await fetchPromo();
  };

  const submitBulk = async () => {
    const entries = selectedBulkIds.map((id) => {
      const draft = bulkDrafts[id];
      return {
        slabBaySlabId: id,
        price: draft.price ? parseCurrencyInput(draft.price) : undefined,
        isPriceTbd: draft.isPriceTbd,
      };
    });

    const invalid = entries.find(
      (entry) =>
        !entry.isPriceTbd &&
        (entry.price == null || !Number.isFinite(entry.price) || entry.price < 0),
    );

    if (invalid) {
      window.alert("Every selected slab needs a price or must be marked TBD.");
      return;
    }

    if (entries.length === 0) {
      window.alert("Select at least one slab.");
      return;
    }

    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/slabs/promotional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(payload?.error || "Failed to add slabs");
        return;
      }
      setShowBulk(false);
      await fetchPromo();
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <>
      {statusTarget && (
        <StatusEditModal
          row={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSave={async (payload) => {
            await fetch(`/api/slabs/promotional/${statusTarget.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            setStatusTarget(null);
            await fetchPromo();
          }}
        />
      )}

      {showBulk && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4">
          <div className="mx-auto mt-8 max-w-6xl rounded-xl bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Many Promotional Slabs</h2>
              <button type="button" onClick={() => setShowBulk(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={bulkSearch}
                  onChange={(event) => setBulkSearch(event.target.value)}
                  placeholder="Search slab ID, name, brand"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Selected: <span className="font-semibold">{selectedBulkIds.length}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const allVisibleSelected = filteredBulkAvailable.every(
                    (row) => bulkDrafts[row.id]?.selected,
                  );
                  setBulkDrafts((prev) => {
                    const next = { ...prev };
                    for (const row of filteredBulkAvailable) {
                      next[row.id] = {
                        ...next[row.id],
                        selected: !allVisibleSelected,
                      };
                    }
                    return next;
                  });
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
              >
                Select All (Visible)
              </button>
            </div>

            {bulkLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">Loading slabs...</div>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Available to add ({filteredBulkAvailable.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                          <th className="py-2 px-3">Pick</th>
                          <th className="py-2 px-3">Slab ID</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Brand</th>
                          <th className="py-2 px-3">Finish</th>
                          <th className="py-2 px-3">Thickness</th>
                          <th className="py-2 px-3">Size</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Rack</th>
                          <th className="py-2 px-3">Price</th>
                          <th className="py-2 px-3">TBD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredBulkAvailable.map((row) => {
                          const draft = bulkDrafts[row.id];
                          if (!draft) return null;
                          return (
                            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={draft.selected}
                                  onChange={(event) =>
                                    setBulkDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: { ...prev[row.id], selected: event.target.checked },
                                    }))
                                  }
                                />
                              </td>
                              <td className="py-2 px-3 font-mono text-xs">{row.id}</td>
                              <td className="py-2 px-3">{row.name}</td>
                              <td className="py-2 px-3">{row.brand || "-"}</td>
                              <td className="py-2 px-3">{row.finish || "-"}</td>
                              <td className="py-2 px-3">{row.thickness}</td>
                              <td className="py-2 px-3">{row.size}</td>
                              <td className="py-2 px-3">{row.type}</td>
                              <td className="py-2 px-3">{row.rackId || "-"}</td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={draft.price}
                                  disabled={draft.isPriceTbd}
                                  onChange={(event) =>
                                    setBulkDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: {
                                        ...prev[row.id],
                                        price: formatCurrencyInput(event.target.value),
                                      },
                                    }))
                                  }
                                  className="w-32 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                                  placeholder="$0.00"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={draft.isPriceTbd}
                                  onChange={(event) =>
                                    setBulkDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: {
                                        ...prev[row.id],
                                        isPriceTbd: event.target.checked,
                                        price: event.target.checked ? "" : prev[row.id].price,
                                      },
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Already added ({bulkAlreadyAdded.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                          <th className="py-2 px-3">Slab ID</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {bulkAlreadyAdded.map((row) => (
                          <tr key={row.id} className="text-gray-500">
                            <td className="py-2 px-3 font-mono text-xs">{row.slabBaySlabId}</td>
                            <td className="py-2 px-3">{row.name}</td>
                            <td className="py-2 px-3">{row.type}</td>
                            <td className="py-2 px-3">{STATUS_LABELS[row.status]}</td>
                            <td className="py-2 px-3">{row.isPriceTbd ? "TBD" : formatPrice(row.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBulk(false)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSubmitting || selectedBulkIds.length === 0}
                onClick={submitBulk}
                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                {bulkSubmitting ? "Adding..." : `Add ${selectedBulkIds.length} Slabs`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Manage Promotional Slabs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add, batch-add, price, and manage statuses for promotional slabs.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setShowBulk(true);
              setBulkSearch("");
              loadBulkData();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Add Many Slabs
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Current Promotional Slabs ({promoRows.length})
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter current list..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {promoRows.length === 0 ? "No promotional slabs yet." : "No matches for your search."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2 pr-4 whitespace-nowrap">Slab ID</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Scanner ID</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Name</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Brand</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Finish</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Thickness</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Size</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Type</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Rack Position</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Price</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Status</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map((row) => {
                    const regularPrice = row.isPriceTbd ? null : row.price / 0.65;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 font-mono text-xs">
                          {row.slabBaySlabId}
                        </td>
                        <td className="py-3 pr-4">
                          {row.scannerId ? (
                            <a
                              href={buildSlabViewUrl(row.scannerId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-mono text-xs"
                            >
                              {row.scannerId}
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-800 dark:text-gray-200 font-medium">{row.name}</td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.brand || "-"}</td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.finish || "-"}</td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.thickness}</td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.size}</td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.type}</td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.rackId || "-"}</td>
                        <td className="py-3 pr-4">
                          {editingId === row.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editPrice}
                                onChange={(event) => setEditPrice(formatCurrencyInput(event.target.value))}
                                className="w-32 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                                placeholder="$0.00"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSavePrice(row)}
                                className="text-emerald-600 hover:text-emerald-700 p-1"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : row.isPriceTbd ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              TBD
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditPrice(formatCurrencyInput(String(row.price)));
                              }}
                              className="text-left font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <div className="inline-flex items-center gap-1">
                                {formatPrice(row.price)}
                                <Edit2 className="w-3 h-3" />
                              </div>
                              <div className="text-xs text-gray-500">35% OFF ({regularPrice ? formatPrice(regularPrice) : "-"} regular)</div>
                            </button>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status]}`}
                          >
                            {STATUS_LABELS[row.status]}
                          </span>
                          {row.status === "ON_HOLD" && (
                            <div className="text-xs text-gray-500 mt-1">
                              {row.holdCustomerName || "-"} / {row.holdJobName || "-"}
                            </div>
                          )}
                          {row.status === "SOLD" && (
                            <div className="text-xs text-gray-500 mt-1">
                              {row.soldCustomerName || row.soldToClientName || "-"}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setStatusTarget(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 px-2 py-1 text-xs hover:bg-blue-100"
                            >
                              <ShieldCheck className="w-3 h-3" /> Edit Status
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id, row.name)}
                              className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Remove from promotional list"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
