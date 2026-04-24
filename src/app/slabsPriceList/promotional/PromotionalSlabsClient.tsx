"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Search, X } from "lucide-react";
import MultiSelectDropdown, {
  type MultiSelectOption,
} from "../ui/MultiSelectDropdown";

const SLAB_VIEW_LICENSE = "532b5c05af7b036ff8a0200d0c8dc6da";
const buildSlabViewUrl = (scannerId: string) =>
  `https://fusiondrivecloud.com/slabview/?license=${SLAB_VIEW_LICENSE}&SlabID=${encodeURIComponent(scannerId)}`;

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
  holdByUserId: string | null;
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
  clientName: string;
  brand: string | null;
  finish: string | null;
  rackId: string | null;
  canReleaseHold: boolean;
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

type CustomerJobPickerProps = {
  selectedCustomer: CustomerOption | null;
  selectedJobId: string;
  onSelectCustomer: (value: CustomerOption | null) => void;
  onSelectJobId: (value: string) => void;
  helperLabel: string;
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
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

const formatReleaseLabel = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const formatCustomerOptionLabel = (customer: CustomerOption) =>
  `#${customer.pipedriveId ?? customer.id} - ${customer.displayName}`;

function CustomerJobPicker({
  selectedCustomer,
  selectedJobId,
  onSelectCustomer,
  onSelectJobId,
  helperLabel,
}: CustomerJobPickerProps) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
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
        const res = await fetch(
          `/api/slabs/promotional/customer-jobs?q=${encodeURIComponent(query)}`,
        );
        if (!res.ok) return;
        const payload = (await res.json()) as { customers?: CustomerOption[] };
        setCustomers(Array.isArray(payload.customers) ? payload.customers : []);
        setShowDropdown(true);
      } finally {
        setLoadingCustomers(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!selectedCustomer) {
      setJobs([]);
      onSelectJobId("");
      return;
    }

    const fetchJobs = async () => {
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

    fetchJobs();
  }, [selectedCustomer, onSelectJobId]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Customer
        </label>
        <div ref={wrapperRef} className="relative">
          <input
            type="text"
            value={selectedCustomer ? formatCustomerOptionLabel(selectedCustomer) : query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (selectedCustomer) onSelectCustomer(null);
            }}
            onFocus={() => {
              if (customers.length > 0) setShowDropdown(true);
            }}
            placeholder="Search customer..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showDropdown && (
            <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-56 overflow-y-auto">
              {loadingCustomers ? (
                <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>
              ) : customers.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">No customers found</li>
              ) : (
                customers.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCustomer(customer);
                        setQuery(formatCustomerOptionLabel(customer));
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCustomerOptionLabel(customer)}
                      </div>
                      {customer.companyName && (
                        <div className="text-xs text-gray-500">{customer.companyName}</div>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Job / Deal
        </label>
        <select
          value={selectedJobId}
          onChange={(event) => onSelectJobId(event.target.value)}
          disabled={!selectedCustomer || loadingJobs}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
        >
          <option value="">
            {selectedCustomer
              ? loadingJobs
                ? "Loading jobs..."
                : "Select job"
              : "Select a customer first"}
          </option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.pipedriveId ? `#${job.pipedriveId} - ` : ""}
              {job.dealTitle || job.jobName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperLabel}</p>
      </div>
    </div>
  );
}

type HoldModalProps = {
  slab: PromoSlab;
  onClose: () => void;
  onConfirm: (payload: {
    holdCustomerId: string;
    holdCustomerName: string;
    holdJobId: string;
    holdJobName: string;
  }) => Promise<void>;
};

function HoldModal({ slab, onClose, onConfirm }: HoldModalProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const holdUntil = useMemo(() => {
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return date.toISOString();
  }, []);

  const canSubmit = Boolean(selectedCustomer && selectedJobId);

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedJobId) return;

    const jobsRes = await fetch(
      `/api/slabs/promotional/customer-jobs?customerId=${encodeURIComponent(selectedCustomer.id)}`,
    );
    if (!jobsRes.ok) return;
    const payload = (await jobsRes.json()) as { jobs?: JobOption[] };
    const job = (payload.jobs ?? []).find((value) => value.id === selectedJobId);
    if (!job) return;

    setSubmitting(true);
    try {
      await onConfirm({
        holdCustomerId: selectedCustomer.id,
        holdCustomerName: selectedCustomer.displayName,
        holdJobId: job.id,
        holdJobName: job.dealTitle || job.jobName,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Put Slab On Hold</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 text-sm text-amber-900 dark:text-amber-200">
          This slab will be on hold for 7 days and return to available on
          <span className="font-semibold"> {formatReleaseLabel(holdUntil)}</span>.
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Slab: <span className="font-medium">{slab.name}</span> ({slab.slabBaySlabId})
        </p>

        <CustomerJobPicker
          selectedCustomer={selectedCustomer}
          selectedJobId={selectedJobId}
          onSelectCustomer={setSelectedCustomer}
          onSelectJobId={setSelectedJobId}
          helperLabel="The hold will be linked to this customer and deal."
        />

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
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Confirm Hold"}
          </button>
        </div>
      </div>
    </div>
  );
}

type SoldModalProps = {
  slab: PromoSlab;
  onClose: () => void;
  onConfirm: (payload: {
    soldCustomerId: string;
    soldCustomerName: string;
    soldJobId: string;
    soldJobName: string;
  }) => Promise<void>;
};

function SoldModal({ slab, onClose, onConfirm }: SoldModalProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(selectedCustomer && selectedJobId);

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedJobId) return;

    const jobsRes = await fetch(
      `/api/slabs/promotional/customer-jobs?customerId=${encodeURIComponent(selectedCustomer.id)}`,
    );
    if (!jobsRes.ok) return;
    const payload = (await jobsRes.json()) as { jobs?: JobOption[] };
    const job = (payload.jobs ?? []).find((value) => value.id === selectedJobId);
    if (!job) return;

    setSubmitting(true);
    try {
      await onConfirm({
        soldCustomerId: selectedCustomer.id,
        soldCustomerName: selectedCustomer.displayName,
        soldJobId: job.id,
        soldJobName: job.dealTitle || job.jobName,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mark Slab As Sold</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Slab: <span className="font-medium">{slab.name}</span> ({slab.slabBaySlabId})
        </p>

        <CustomerJobPicker
          selectedCustomer={selectedCustomer}
          selectedJobId={selectedJobId}
          onSelectCustomer={setSelectedCustomer}
          onSelectJobId={setSelectedJobId}
          helperLabel="Sale information will be linked to this customer and deal."
        />

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
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Confirm Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromotionalSlabsClient() {
  const [rows, setRows] = useState<PromoSlab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slabNameSearch, setSlabNameSearch] = useState("");
  const [slabIdSearch, setSlabIdSearch] = useState("");
  const [clientNameSearch, setClientNameSearch] = useState("");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterBrands, setFilterBrands] = useState<string[]>([]);
  const [filterFinishes, setFilterFinishes] = useState<string[]>([]);
  const [filterThicknesses, setFilterThicknesses] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [holdTarget, setHoldTarget] = useState<PromoSlab | null>(null);
  const [soldTarget, setSoldTarget] = useState<PromoSlab | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/slabs/promotional", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as PromoSlab[];
      setRows(Array.isArray(payload) ? payload : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const typeOptions = useMemo<MultiSelectOption[]>(() => {
    const values = Array.from(new Set(rows.map((row) => row.type))).sort();
    return values.map((value) => ({ value, label: value }));
  }, [rows]);

  const brandOptions = useMemo<MultiSelectOption[]>(() => {
    const values = Array.from(new Set(rows.map((row) => row.brand ?? "").filter(Boolean))).sort();
    return values.map((value) => ({ value, label: value }));
  }, [rows]);

  const finishOptions = useMemo<MultiSelectOption[]>(() => {
    const values = Array.from(new Set(rows.map((row) => row.finish ?? "").filter(Boolean))).sort();
    return values.map((value) => ({ value, label: value }));
  }, [rows]);

  const thicknessOptions = useMemo<MultiSelectOption[]>(() => {
    const values = Array.from(new Set(rows.map((row) => row.thickness).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    return values.map((value) => ({ value, label: value }));
  }, [rows]);

  const statusOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: "AVAILABLE", label: "Available" },
      { value: "ON_HOLD", label: "On Hold" },
      { value: "SOLD", label: "Sold" },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const nameQuery = slabNameSearch.trim().toLowerCase();
    const slabIdQuery = slabIdSearch.trim().toLowerCase();
    const clientQuery = clientNameSearch.trim().toLowerCase();

    return rows.filter((row) => {
      if (nameQuery && !row.name.toLowerCase().includes(nameQuery)) return false;
      if (slabIdQuery && !row.slabBaySlabId.toLowerCase().includes(slabIdQuery)) return false;
      if (clientQuery) {
        const clientValues = [
          row.holdCustomerName,
          row.soldCustomerName,
          row.soldToClientName,
          row.clientName,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        if (!clientValues.some((value) => value.includes(clientQuery))) return false;
      }
      if (filterTypes.length > 0 && !filterTypes.includes(row.type)) return false;
      if (filterBrands.length > 0 && !filterBrands.includes(row.brand ?? "")) return false;
      if (filterFinishes.length > 0 && !filterFinishes.includes(row.finish ?? "")) return false;
      if (filterThicknesses.length > 0 && !filterThicknesses.includes(row.thickness)) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(row.status)) return false;
      return true;
    });
  }, [
    rows,
    slabNameSearch,
    slabIdSearch,
    clientNameSearch,
    filterTypes,
    filterBrands,
    filterFinishes,
    filterThicknesses,
    filterStatuses,
  ]);

  const hasActiveFilters =
    Boolean(slabNameSearch) ||
    Boolean(slabIdSearch) ||
    Boolean(clientNameSearch) ||
    filterTypes.length > 0 ||
    filterBrands.length > 0 ||
    filterFinishes.length > 0 ||
    filterThicknesses.length > 0 ||
    filterStatuses.length > 0;

  const updateRow = async (id: string, payload: Record<string, unknown>) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/slabs/promotional/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorPayload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error || "Failed to update slab status");
      }
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const copyInfo = async (row: PromoSlab) => {
    const text = [
      `SLAB ID: ${row.slabBaySlabId}`,
      `SCANNER ID: ${row.scannerId ?? "-"}`,
      `NAME: ${row.name}`,
      `BRAND: ${row.brand ?? "-"}`,
      `FINISH: ${row.finish ?? "-"}`,
      `THICKNESS: ${row.thickness}`,
      `SIZE: ${row.size}`,
      `TYPE: ${row.type}`,
      `RACK POSITION: ${row.rackId ?? "-"}`,
      `STATUS: ${STATUS_LABELS[row.status]}`,
      `PRICE: ${row.isPriceTbd ? "TBD" : formatPrice(row.price)}`,
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopiedId(row.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  };

  return (
    <>
      {holdTarget && (
        <HoldModal
          slab={holdTarget}
          onClose={() => setHoldTarget(null)}
          onConfirm={async (payload) => {
            await updateRow(holdTarget.id, {
              status: "ON_HOLD",
              holdCustomerId: payload.holdCustomerId,
              holdCustomerName: payload.holdCustomerName,
              holdJobId: payload.holdJobId,
              holdJobName: payload.holdJobName,
            });
            setHoldTarget(null);
          }}
        />
      )}

      {soldTarget && (
        <SoldModal
          slab={soldTarget}
          onClose={() => setSoldTarget(null)}
          onConfirm={async (payload) => {
            await updateRow(soldTarget.id, {
              status: "SOLD",
              soldCustomerId: payload.soldCustomerId,
              soldCustomerName: payload.soldCustomerName,
              soldJobId: payload.soldJobId,
              soldJobName: payload.soldJobName,
            });
            setSoldTarget(null);
          }}
        />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Promotional Slabs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            GMD and Remnant slabs available at special prices.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative w-full sm:w-44 lg:w-48 xl:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={slabNameSearch}
                onChange={(event) => setSlabNameSearch(event.target.value)}
                placeholder="Slab name"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative w-full sm:w-36 lg:w-40 xl:w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={slabIdSearch}
                onChange={(event) => setSlabIdSearch(event.target.value)}
                placeholder="Slab ID"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative w-full sm:w-44 lg:w-48 xl:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={clientNameSearch}
                onChange={(event) => setClientNameSearch(event.target.value)}
                placeholder="Client name"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-full sm:w-32 lg:w-36">
              <MultiSelectDropdown label="Type" options={typeOptions} selectedValues={filterTypes} onChange={setFilterTypes} />
            </div>
            <div className="w-full sm:w-32 lg:w-36">
              <MultiSelectDropdown label="Brand" options={brandOptions} selectedValues={filterBrands} onChange={setFilterBrands} />
            </div>
            <div className="w-full sm:w-32 lg:w-36">
              <MultiSelectDropdown label="Finish" options={finishOptions} selectedValues={filterFinishes} onChange={setFilterFinishes} />
            </div>
            <div className="w-full sm:w-32 lg:w-36">
              <MultiSelectDropdown
                label="Thickness"
                options={thicknessOptions}
                selectedValues={filterThicknesses}
                onChange={setFilterThicknesses}
              />
            </div>
            <div className="w-full sm:w-32 lg:w-36">
              <MultiSelectDropdown label="Status" options={statusOptions} selectedValues={filterStatuses} onChange={setFilterStatuses} />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filtered.length} of {rows.length} slabs
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSlabNameSearch("");
                  setSlabIdSearch("");
                  setClientNameSearch("");
                  setFilterTypes([]);
                  setFilterBrands([]);
                  setFilterFinishes([]);
                  setFilterThicknesses([]);
                  setFilterStatuses([]);
                }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" /> Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading promotional slabs...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">No promotional slabs found.</div>
          ) : (
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
                  const isWorking = actionLoading === row.id;
                  const regularPrice = row.isPriceTbd ? null : row.price / 0.65;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{row.slabBaySlabId}</td>
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
                      <td className="py-3 pr-4 text-gray-800 dark:text-gray-200 font-medium">
                        {row.isPriceTbd ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            TBD
                          </span>
                        ) : (
                          <div>
                            <div>{formatPrice(row.price)}</div>
                            <div className="text-xs text-gray-500">35% OFF {regularPrice ? `(${formatPrice(regularPrice)} regular)` : ""}</div>
                          </div>
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
                            Reserved by {row.holdByUserName || "-"}
                            <div>
                              For: {row.holdCustomerName || "-"} / {row.holdJobName || "-"}
                            </div>
                            <div>Release: {formatReleaseLabel(row.holdUntil)}</div>
                          </div>
                        )}
                        {row.status === "SOLD" && (
                          <div className="text-xs text-gray-500 mt-1">
                            {row.soldCustomerName || row.soldToClientName || "-"}
                            <div>{row.soldJobName || "-"}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {row.status !== "AVAILABLE" && (
                            <button
                              type="button"
                              disabled={isWorking || (row.status === "ON_HOLD" && !row.canReleaseHold)}
                              title={
                                row.status === "ON_HOLD" && !row.canReleaseHold
                                  ? "Only admin/office or who placed the hold can release it"
                                  : "Mark available"
                              }
                              onClick={() => updateRow(row.id, { status: "AVAILABLE" })}
                              className="px-2.5 py-1 text-xs rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Available
                            </button>
                          )}
                          {row.status === "AVAILABLE" && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => setHoldTarget(row)}
                              className="px-2.5 py-1 text-xs rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
                            >
                              On Hold
                            </button>
                          )}
                          {row.status === "AVAILABLE" && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => setSoldTarget(row)}
                              className="px-2.5 py-1 text-xs rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                            >
                              Sold
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => copyInfo(row)}
                            className="px-2.5 py-1 text-xs rounded-md bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                          >
                            {copiedId === row.id ? (
                              <span className="inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Copied
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Copy className="w-3 h-3" /> Copy
                              </span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
