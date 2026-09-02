"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Save, Printer, RotateCcw } from "lucide-react";
import {
  computeLineItemTotal,
  computeCabinetsTotal,
  computeCabinetEstimateFooterTotals,
  computeDiscountAmount,
  computeLineItemsCustomizationSurchargeTotal,
  computeSpecialCustomizationTotal,
  discountPercentLabel,
  CustomizationType,
  DISCOUNT_PERCENT_OPTIONS,
  formatCurrency,
} from "@/lib/cabinetEstimateCalc";

type LookupJob = {
  id: string;
  dealId: string | null;
  dealName: string | null;
  address: string | null;
  status: string;
};

type LookupResult = {
  id: string;
  displayName: string;
  pipedriveId: string | null;
  contractor: string | null;
  customerAddress: string | null;
  jobs: LookupJob[];
};

type LineItem = {
  key: string;
  qty: number;
  code: string;
  description: string;
  isCustomization: boolean;
  customizationType: CustomizationType | null;
  customizationValue: number;
  note: string;
  unitPrice: number;
};

type SpecialCustomizationItem = {
  id: string;
  name: string;
  price: number;
};

// A "New Estimate" always starts with this many blank rows, and the table
// keeps at least this many blank rows available as the user types (see
// handleItemKeyDown) so there's always room to keep going without reaching
// for "Add Item".
const MIN_BLANK_ROWS = 5;
const MIN_TRAILING_BLANK_ROWS = 2;

let itemKeySeq = 0;
function newItemKey() {
  itemKeySeq += 1;
  return `item-${Date.now()}-${itemKeySeq}`;
}

function emptyLineItem(): LineItem {
  return {
    key: newItemKey(),
    qty: 0,
    code: "",
    description: "",
    isCustomization: false,
    customizationType: null,
    customizationValue: 0,
    note: "",
    unitPrice: 0,
  };
}

function makeBlankRows(count: number): LineItem[] {
  return Array.from({ length: count }, () => emptyLineItem());
}

function isEmptyLineItem(item: LineItem): boolean {
  return (
    !item.code.trim() &&
    !item.description.trim() &&
    !item.note.trim() &&
    !item.isCustomization &&
    item.unitPrice === 0
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  currentUserName: string;
  companyName: string;
  companyLogoUrl: string;
  companyPhone: string | null;
  companyAddress: string | null;
  specialCustomizationItems: SpecialCustomizationItem[];
};

export default function CabinetEstimateForm(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editEstimateId = searchParams.get("estimateId");

  const [estimateId, setEstimateId] = useState<string | null>(editEstimateId);
  const [estimateNumber, setEstimateNumber] = useState("");
  const [date, setDate] = useState(todayIso());

  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [clientJobs, setClientJobs] = useState<LookupJob[]>([]);
  const [clientResults, setClientResults] = useState<LookupResult[]>([]);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearching, setClientSearching] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement>(null);

  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobName, setJobName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [dealId, setDealId] = useState("");
  const [dealName, setDealName] = useState("");
  const [email, setEmail] = useState("");
  const [salesRep, setSalesRep] = useState(props.currentUserName);
  const [brand, setBrand] = useState("");
  const [groupColor, setGroupColor] = useState("");
  const [removal, setRemoval] = useState("");
  const [projectType, setProjectType] = useState("");
  const [version, setVersion] = useState("");

  const [lineItems, setLineItems] = useState<LineItem[]>(() =>
    makeBlankRows(MIN_BLANK_ROWS),
  );
  // Refs to the Code/Note inputs, keyed by "rowIndex:field" - lets Enter in
  // one of those cells move focus straight down to the same cell in the
  // next row, spreadsheet-style (see handleAdvanceRowKeyDown).
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  function registerCellRef(
    index: number,
    field: "code" | "note",
    el: HTMLInputElement | null,
  ) {
    const key = `${index}:${field}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }
  function focusCell(index: number, field: "code" | "note") {
    const el = cellRefs.current.get(`${index}:${field}`);
    if (el) {
      el.focus();
      el.select();
    }
  }

  const [standardCabinetsCount, setStandardCabinetsCount] = useState(0);
  const [doubleCabinetsCount, setDoubleCabinetsCount] = useState(0);
  const [customCabinetsCount, setCustomCabinetsCount] = useState(0);
  const [miscCabinetsCount, setMiscCabinetsCount] = useState(0);
  const [itemsQuantity, setItemsQuantity] = useState(0);
  const [microwaveInstallation, setMicrowaveInstallation] = useState(false);

  const [discountPercent, setDiscountPercent] = useState(0);
  const [removalAmount, setRemovalAmount] = useState(0);
  const [installationAmount, setInstallationAmount] = useState(0);
  // Special Customization - an admin-managed catalog of customization types
  // (see /cabinet-estimates/settings). The user just picks a qty per type;
  // the $ amount is always derived from the catalog price, never typed in.
  const [specialCustomizationQtyById, setSpecialCustomizationQtyById] = useState<
    Record<string, number>
  >({});
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(Boolean(editEstimateId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setSpecialCustomizationQty(itemId: string, qty: number) {
    setSpecialCustomizationQtyById((prev) => ({ ...prev, [itemId]: qty }));
  }

  // Close the customer search dropdown when clicking elsewhere.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (clientBoxRef.current && !clientBoxRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Live search the Customer Program as the user types (reuses the same
  // lookup endpoint the Fabrication Orders program uses - generic
  // customer/job search, no reason to duplicate it here).
  useEffect(() => {
    if (!clientDropdownOpen) return;
    const q = customerName.trim();
    if (q.length < 2) {
      setClientResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setClientSearching(true);
      try {
        const res = await fetch(
          `/api/fabrication-orders/lookup?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        setClientResults(res.ok ? json.results || [] : []);
      } catch (err: any) {
        if (err?.name !== "AbortError") setClientResults([]);
      } finally {
        if (!controller.signal.aborted) setClientSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [customerName, clientDropdownOpen]);

  function selectClient(result: LookupResult) {
    setCustomerName(result.displayName);
    setCustomerId(result.id);
    setClientJobs(result.jobs || []);
    setSelectedJobId("");
    setDealId("");
    setDealName("");
    setJobName("");
    setJobAddress(result.customerAddress || "");
    setClientDropdownOpen(false);
    setClientResults([]);
  }

  function selectJob(jobId: string) {
    setSelectedJobId(jobId);
    const job = clientJobs.find((j) => j.id === jobId);
    setDealId(job?.dealId || jobId || "");
    setDealName(job?.dealName || "");
    setJobName(job?.dealName || "");
    if (job?.address) setJobAddress(job.address);
  }

  // Load an existing estimate for editing.
  useEffect(() => {
    if (!editEstimateId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/cabinet-estimates/${editEstimateId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load estimate");

        setEstimateId(json.id);
        setEstimateNumber(json.estimateNumber || "");
        setDate(json.date ? String(json.date).slice(0, 10) : todayIso());
        setCustomerName(json.customerName || "");
        setCustomerId(json.customerId || "");
        setJobName(json.jobName || "");
        setJobAddress(json.jobAddress || "");
        setEmail(json.email || "");
        setDealId(json.dealId || "");
        setDealName(json.dealName || "");
        setSalesRep(json.salesRep || "");
        setBrand(json.brand || "");
        setGroupColor(json.groupColor || "");
        setRemoval(json.removal || "");
        setProjectType(json.projectType || "");
        setVersion(json.version || "");
        setStandardCabinetsCount(json.standardCabinetsCount || 0);
        setDoubleCabinetsCount(json.doubleCabinetsCount || 0);
        setCustomCabinetsCount(json.customCabinetsCount || 0);
        setMiscCabinetsCount(json.miscCabinetsCount || 0);
        setItemsQuantity(json.itemsQuantity || 0);
        setMicrowaveInstallation(Boolean(json.microwaveInstallation));
        setDiscountPercent(json.discountPercent || 0);
        setRemovalAmount(json.removalAmount || 0);
        setInstallationAmount(json.installationAmount || 0);
        setNotes(json.notes || "");
        const qtyById: Record<string, number> = {};
        for (const line of json.specialCustomizationLines || []) {
          if (line.itemId) qtyById[line.itemId] = line.qty ?? 0;
        }
        setSpecialCustomizationQtyById(qtyById);
        setLineItems(
          (json.lineItems || []).length > 0
            ? json.lineItems.map((item: any) => ({
                key: newItemKey(),
                qty: item.qty ?? 0,
                code: item.code || "",
                description: item.description || "",
                isCustomization: Boolean(item.isCustomization),
                customizationType:
                  item.customizationType === "percent" || item.customizationType === "flat"
                    ? item.customizationType
                    : null,
                customizationValue: item.customizationValue ?? 0,
                note: item.note || "",
                unitPrice: item.unitPrice ?? 0,
              }))
            : makeBlankRows(MIN_BLANK_ROWS),
        );
      } catch (err: any) {
        setError(err?.message || "Failed to load estimate");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEstimateId]);

  const cabinetsTotal = useMemo(
    () =>
      computeCabinetsTotal(
        lineItems.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
      ),
    [lineItems],
  );

  const discountAmount = useMemo(
    () => computeDiscountAmount(cabinetsTotal, discountPercent),
    [cabinetsTotal, discountPercent],
  );

  const specialCustomizationTotal = useMemo(
    () =>
      computeSpecialCustomizationTotal(
        props.specialCustomizationItems.map((item) => ({
          qty: specialCustomizationQtyById[item.id] || 0,
          price: item.price,
        })),
      ),
    [props.specialCustomizationItems, specialCustomizationQtyById],
  );

  // Each line item flagged "Custom" carries its own extra Installation
  // surcharge (percent of that line's own qty*unitPrice, or a flat $
  // amount per unit) - it never touches that line's own total/the
  // Cabinets total, it's a separate amount that rolls into Installation.
  const lineCustomizationSurchargeTotal = useMemo(
    () =>
      computeLineItemsCustomizationSurchargeTotal(
        lineItems.map((item) => ({
          qty: item.qty,
          unitPrice: item.unitPrice,
          isCustomization: item.isCustomization,
          customizationType: item.customizationType,
          customizationValue: item.customizationValue,
        })),
      ),
    [lineItems],
  );

  const { cabinetsSubtotal, installationTotal, total } = useMemo(
    () =>
      computeCabinetEstimateFooterTotals({
        cabinetsTotal,
        discount: discountAmount,
        removalAmount,
        installationAmount,
        customizationAmount: specialCustomizationTotal,
        lineCustomizationSurchargeAmount: lineCustomizationSurchargeTotal,
      }),
    [
      cabinetsTotal,
      discountAmount,
      removalAmount,
      installationAmount,
      specialCustomizationTotal,
      lineCustomizationSurchargeTotal,
    ],
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  }

  function removeItem(index: number) {
    setLineItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  // Pressing Enter in a row "confirms" it - if fewer than
  // MIN_TRAILING_BLANK_ROWS blank rows are left in the table after that,
  // a fresh blank row is appended so there's always room to keep typing.
  function ensureTrailingBlankRow() {
    setLineItems((prev) => {
      const blankCount = prev.filter(isEmptyLineItem).length;
      if (blankCount < MIN_TRAILING_BLANK_ROWS) {
        return [...prev, emptyLineItem()];
      }
      return prev;
    });
  }

  function handleItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    ensureTrailingBlankRow();
  }

  // Code and Note get the same "grow the table" behavior as every other
  // column, plus they move focus straight down into the same column of the
  // next row so the user can keep typing without reaching for the mouse.
  function handleAdvanceRowKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    field: "code" | "note",
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    ensureTrailingBlankRow();
    setTimeout(() => focusCell(index + 1, field), 0);
  }

  function resetForm() {
    setEstimateId(null);
    setEstimateNumber("");
    setDate(todayIso());
    setCustomerName("");
    setCustomerId("");
    setClientJobs([]);
    setSelectedJobId("");
    setJobName("");
    setJobAddress("");
    setDealId("");
    setDealName("");
    setEmail("");
    setSalesRep(props.currentUserName);
    setBrand("");
    setGroupColor("");
    setRemoval("");
    setProjectType("");
    setVersion("");
    setLineItems(makeBlankRows(MIN_BLANK_ROWS));
    setStandardCabinetsCount(0);
    setDoubleCabinetsCount(0);
    setCustomCabinetsCount(0);
    setMiscCabinetsCount(0);
    setItemsQuantity(0);
    setMicrowaveInstallation(false);
    setDiscountPercent(0);
    setRemovalAmount(0);
    setInstallationAmount(0);
    setSpecialCustomizationQtyById({});
    setNotes("");
    setMessage(null);
    setError(null);
    router.replace("/cabinet-estimates");
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        date,
        customerName,
        customerId: customerId || null,
        jobId: selectedJobId || null,
        jobName,
        jobAddress,
        email,
        dealId,
        dealName,
        salesRep,
        brand,
        groupColor,
        removal,
        projectType,
        version,
        standardCabinetsCount,
        doubleCabinetsCount,
        customCabinetsCount,
        miscCabinetsCount,
        itemsQuantity,
        microwaveInstallation,
        discountPercent,
        removalAmount,
        installationAmount,
        notes,
        lineItems: lineItems.map((item) => ({
          qty: item.qty,
          code: item.code,
          description: item.description,
          isCustomization: item.isCustomization,
          customizationType: item.customizationType,
          customizationValue: item.customizationValue,
          note: item.note,
          unitPrice: item.unitPrice,
        })),
        specialCustomizationLines: props.specialCustomizationItems
          .map((item) => ({ itemId: item.id, qty: specialCustomizationQtyById[item.id] || 0 }))
          .filter((line) => line.qty > 0),
      };

      const res = await fetch(
        estimateId
          ? `/api/cabinet-estimates/${estimateId}`
          : "/api/cabinet-estimates",
        {
          method: estimateId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save estimate");

      setEstimateId(json.id);
      setEstimateNumber(json.estimateNumber || estimateNumber);
      setMessage(estimateId ? "Estimate updated." : "Estimate saved.");
      router.replace(`/cabinet-estimates?estimateId=${json.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to save estimate");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    if (!estimateId) {
      setError("Save the estimate before printing.");
      return;
    }
    window.open(`/cabinet-estimates/print/${estimateId}?autoprint=1`, "_blank");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cabinet Estimate
          </h1>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {estimateNumber
              ? `Estimate #${estimateNumber}`
              : "New estimate - estimate # is assigned on save."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RotateCcw className="h-4 w-4" /> New
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!estimateId}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Estimate"}
          </button>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          }`}
        >
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Loading estimate...
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Header - mimics the printed sheet's letterhead + info block */}
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_170px]">
              <div className="flex flex-col items-center justify-center gap-1 border-b border-gray-300 p-3 text-center dark:border-gray-600 lg:border-b-0 lg:border-r">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={props.companyLogoUrl}
                  alt={props.companyName}
                  className="h-24 w-auto max-w-[220px] object-contain"
                />
                {props.companyAddress && (
                  <div className="text-[9px] leading-tight text-gray-500 dark:text-gray-400">
                    {props.companyAddress}
                  </div>
                )}
                {props.companyPhone && (
                  <div className="text-[9px] leading-tight text-gray-500 dark:text-gray-400">
                    Phone: {props.companyPhone}
                  </div>
                )}
              </div>

              <div className="divide-y divide-gray-300 border-b border-gray-300 dark:divide-gray-600 dark:border-gray-600 lg:border-b-0 lg:border-r">
                <div
                  ref={clientBoxRef}
                  className="relative grid grid-cols-[130px_1fr] divide-x divide-gray-300 dark:divide-gray-600"
                >
                  <div className="flex items-center bg-blue-600 px-2 py-0.5 text-[9px] font-semibold text-white">
                    Customer Name
                  </div>
                  <div className="relative">
                    <input
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setClientDropdownOpen(true);
                      }}
                      onFocus={() => setClientDropdownOpen(true)}
                      placeholder="Search customers..."
                      className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                      autoComplete="off"
                    />
                    {clientDropdownOpen && customerName.trim().length >= 2 && (
                      <div className="absolute left-0 top-full z-50 max-h-64 w-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800">
                        {clientSearching ? (
                          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                            Searching...
                          </div>
                        ) : clientResults.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                            No matching customers.
                          </div>
                        ) : (
                          clientResults.map((result) => (
                            <button
                              key={result.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectClient(result);
                              }}
                              className="block w-full truncate px-3 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-gray-700"
                            >
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {result.displayName}
                              </span>
                              {result.customerAddress && (
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                  {result.customerAddress}
                                </span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[130px_1fr] divide-x divide-gray-300 dark:divide-gray-600">
                  <div className="flex items-center bg-blue-600 px-2 py-0.5 text-[9px] font-semibold text-white">
                    Job Name
                  </div>
                  {clientJobs.length > 0 ? (
                    <select
                      value={selectedJobId}
                      onChange={(e) => selectJob(e.target.value)}
                      className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                    >
                      <option value="">Select a job/deal...</option>
                      {clientJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.dealName || job.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      placeholder="Job / deal name"
                      className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                    />
                  )}
                </div>

                <HeaderRow label="Job Address">
                  <input
                    value={jobAddress}
                    onChange={(e) => setJobAddress(e.target.value)}
                    placeholder="Job address"
                    className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                  />
                </HeaderRow>

                <HeaderRow label="Email Address">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                  />
                </HeaderRow>

                <HeaderRow label="Salesperson">
                  <input
                    value={salesRep}
                    onChange={(e) => setSalesRep(e.target.value)}
                    className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                  />
                </HeaderRow>

                <HeaderRow label="Brand">
                  <input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. GMDPRO"
                    className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                  />
                </HeaderRow>

                <HeaderRow label="Group / Color">
                  <input
                    value={groupColor}
                    onChange={(e) => setGroupColor(e.target.value)}
                    placeholder="e.g. Liberty Shaker White - LSW"
                    className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                  />
                </HeaderRow>

                <HeaderRow label="Removal">
                  <input
                    value={removal}
                    onChange={(e) => setRemoval(e.target.value)}
                    className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                  />
                </HeaderRow>

                <HeaderRow label="Project Type">
                  <input
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full bg-transparent px-2 py-0.5 text-[11px] text-gray-900 outline-none dark:text-gray-100"
                  />
                </HeaderRow>
              </div>

              <div className="flex flex-col gap-1 p-1.5">
                <MetaBox label="Estimate #">
                  <div className="mt-0.5 text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                    {estimateNumber || "assigned on save"}
                  </div>
                </MetaBox>
                <MetaBox label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1.5 py-px text-[10px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </MetaBox>
                <MetaBox label="Version">
                  <input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="optional"
                    className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1.5 py-px text-[10px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </MetaBox>
              </div>
            </div>
          </div>

          {/* Body - item table */}
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 text-xs uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    <th className="w-14 border border-gray-300 px-2 py-1.5 text-center dark:border-gray-600">
                      Qty
                    </th>
                    <th className="w-24 border border-gray-300 px-2 py-1.5 text-left dark:border-gray-600">
                      Code
                    </th>
                    <th className="w-48 border border-gray-300 px-2 py-1.5 text-left dark:border-gray-600">
                      Description
                    </th>
                    <th className="w-24 border border-gray-300 px-2 py-1.5 text-center dark:border-gray-600">
                      Custom
                    </th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left dark:border-gray-600">
                      Note
                    </th>
                    <th className="w-28 border border-gray-300 px-2 py-1.5 text-right dark:border-gray-600">
                      P.Unit
                    </th>
                    <th className="w-28 border border-gray-300 px-2 py-1.5 text-right dark:border-gray-600">
                      P.Total
                    </th>
                    <th className="w-10 border border-gray-300 px-1 py-2 dark:border-gray-600" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.key} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="border border-gray-200 p-1 dark:border-gray-700">
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={item.qty === 0 ? "" : item.qty}
                          onChange={(e) =>
                            updateItem(index, {
                              qty: e.target.value === "" ? 0 : Number(e.target.value) || 0,
                            })
                          }
                          onKeyDown={handleItemKeyDown}
                          className="w-full bg-transparent px-1.5 py-0.5 text-center text-xs text-gray-900 outline-none dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="border border-gray-200 p-1 dark:border-gray-700">
                        <input
                          ref={(el) => registerCellRef(index, "code", el)}
                          value={item.code}
                          onChange={(e) => updateItem(index, { code: e.target.value })}
                          onKeyDown={(e) => handleAdvanceRowKeyDown(e, index, "code")}
                          className="w-full bg-transparent px-1.5 py-0.5 text-xs text-gray-900 outline-none dark:text-gray-100"
                        />
                      </td>
                      <td className="border border-gray-200 p-1 dark:border-gray-700">
                        <input
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, { description: e.target.value })
                          }
                          onKeyDown={handleItemKeyDown}
                          className="w-full bg-transparent px-1.5 py-0.5 text-xs text-gray-900 outline-none dark:text-gray-100"
                        />
                      </td>
                      <td className="border border-gray-200 p-1 text-center align-top dark:border-gray-700">
                        <label className="flex w-full cursor-pointer items-center justify-center py-0.5">
                          <input
                            type="checkbox"
                            checked={item.isCustomization}
                            onChange={(e) =>
                              updateItem(index, {
                                isCustomization: e.target.checked,
                                customizationType: e.target.checked
                                  ? item.customizationType || "percent"
                                  : null,
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                          />
                        </label>
                        {item.isCustomization && (
                          <div className="mt-0.5 flex items-center justify-center gap-0.5">
                            <select
                              value={item.customizationType || "percent"}
                              onChange={(e) =>
                                updateItem(index, {
                                  customizationType: e.target.value as CustomizationType,
                                })
                              }
                              className="rounded border border-gray-300 bg-white text-[9px] leading-tight text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                              title="Installation surcharge type"
                            >
                              <option value="percent">%</option>
                              <option value="flat">$</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.customizationValue === 0 ? "" : item.customizationValue}
                              onChange={(e) =>
                                updateItem(index, {
                                  customizationValue:
                                    e.target.value === "" ? 0 : Number(e.target.value) || 0,
                                })
                              }
                              placeholder="0"
                              title="Installation surcharge value"
                              className="w-9 rounded border border-gray-300 bg-white px-0.5 text-right text-[9px] text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-200 p-1 dark:border-gray-700">
                        <input
                          ref={(el) => registerCellRef(index, "note", el)}
                          value={item.note}
                          onChange={(e) => updateItem(index, { note: e.target.value })}
                          onKeyDown={(e) => handleAdvanceRowKeyDown(e, index, "note")}
                          className="w-full bg-transparent px-1.5 py-0.5 text-xs text-gray-900 outline-none dark:text-gray-100"
                        />
                      </td>
                      <td className="border border-gray-200 p-1 dark:border-gray-700">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                            $
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(index, {
                                unitPrice: Number(e.target.value) || 0,
                              })
                            }
                            onKeyDown={handleItemKeyDown}
                            className="w-full bg-transparent py-0.5 pl-4 pr-1 text-right text-xs text-gray-900 outline-none dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </td>
                      <td className="border border-gray-200 px-2 py-0.5 text-right text-xs font-medium text-gray-900 dark:border-gray-700 dark:text-gray-100">
                        {formatCurrency(computeLineItemTotal(item.qty, item.unitPrice))}
                      </td>
                      <td className="border border-gray-200 p-1 text-center dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={lineItems.length <= 1}
                          className="inline-flex items-center justify-center rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
                          title="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 p-2 dark:border-gray-700">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>
          </div>

          {/* Footer - notes, cabinets summary, and price distribution side by side */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px_300px]">
            <div className="flex flex-col rounded-xl border border-gray-300 bg-white p-2.5 dark:border-gray-600 dark:bg-gray-800">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Notes
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[120px] flex-1 resize-none rounded-md border border-gray-300 bg-white p-1.5 text-xs text-gray-900 outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Notes for this estimate..."
              />
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
              <div className="bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Cabinets Summary
              </div>
              <div className="divide-y divide-gray-200 text-xs dark:divide-gray-700">
                <CategoryRow label="Standard Cabinets">
                  <NumberField value={standardCabinetsCount} onChange={setStandardCabinetsCount} />
                </CategoryRow>
                <CategoryRow label="Double Cabinets">
                  <NumberField value={doubleCabinetsCount} onChange={setDoubleCabinetsCount} />
                </CategoryRow>
                <CategoryRow label="Custom Cabinets">
                  <NumberField value={customCabinetsCount} onChange={setCustomCabinetsCount} />
                </CategoryRow>
                <CategoryRow label="Miscellaneous">
                  <NumberField value={miscCabinetsCount} onChange={setMiscCabinetsCount} />
                </CategoryRow>
                <CategoryRow label="Quantity of Items">
                  <NumberField value={itemsQuantity} onChange={setItemsQuantity} />
                </CategoryRow>
                <CategoryRow label="Microwave Installation">
                  <select
                    value={microwaveInstallation ? "yes" : "no"}
                    onChange={(e) => setMicrowaveInstallation(e.target.value === "yes")}
                    className="w-20 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </CategoryRow>
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
              <div className="bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Total Summary
              </div>
              <div className="flex flex-1 flex-col divide-y divide-gray-200 text-xs dark:divide-gray-700">
                <TotalsRow label="Cabinets">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(cabinetsTotal)}
                  </span>
                </TotalsRow>
                <TotalsRow label="Discount" className="bg-red-50 dark:bg-red-950/30">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                      className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      {DISCOUNT_PERCENT_OPTIONS.map((percent) => (
                        <option key={percent} value={percent}>
                          {discountPercentLabel(percent)}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] font-medium text-red-700 dark:text-red-300">
                      {formatCurrency(discountAmount)}
                    </span>
                  </div>
                </TotalsRow>
                <TotalsRow label="Cabinets Subtotal" className="bg-amber-50 dark:bg-amber-950/30">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(cabinetsSubtotal)}
                  </span>
                </TotalsRow>
                <TotalsRow label="Removal" className="bg-red-50 dark:bg-red-950/30">
                  <NumberField value={removalAmount} onChange={setRemovalAmount} step="0.01" />
                </TotalsRow>
                <TotalsRow label="Installation" className="bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-center gap-1.5">
                    <NumberField
                      value={installationAmount}
                      onChange={setInstallationAmount}
                      step="0.01"
                      title="Manual installation amount"
                    />
                    <span
                      className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                      title="Manual amount plus Special Customization and per-item Custom surcharges"
                    >
                      {formatCurrency(installationTotal)}
                    </span>
                  </div>
                </TotalsRow>
                <div className="mt-auto flex items-center justify-between bg-blue-600 px-2.5 py-1.5 text-white">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total</span>
                  <span className="text-sm font-bold">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Special Customization - admin-managed catalog of customization
              types (see Settings). Runs as a full-height sidebar alongside
              the header/table/footer, starting at the top of the form, per
              Diego's request; the user enters a qty per type and the $
              contribution rolls into the "Customization" row in Total
              Summary above. */}
          <div className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-300 bg-white lg:w-56 dark:border-gray-600 dark:bg-gray-800">
            <div className="bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Special Customization
            </div>
            {props.specialCustomizationItems.length === 0 ? (
              <div className="p-3 text-xs text-gray-500 dark:text-gray-400">
                No customization types configured yet - add them under
                Special Customization Settings.
              </div>
            ) : (
              <div className="divide-y divide-gray-200 text-xs dark:divide-gray-700">
                {props.specialCustomizationItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1"
                  >
                    <span className="truncate pr-1 text-gray-700 dark:text-gray-300">
                      {item.name}
                    </span>
                    <NumberField
                      value={specialCustomizationQtyById[item.id] || 0}
                      onChange={(value) => setSpecialCustomizationQty(item.id, value)}
                      step="1"
                      widthClassName="w-14"
                      blankWhenZero
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}

function HeaderRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] divide-x divide-gray-300 dark:divide-gray-600">
      <div className="flex items-center bg-blue-600 px-2 py-0.5 text-[9px] font-semibold text-white">
        {label}
      </div>
      {children}
    </div>
  );
}

function MetaBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gray-300 p-1 text-[9px] dark:border-gray-600">
      <div className="font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      {children}
    </div>
  );
}

function CategoryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1">
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
      {children}
    </div>
  );
}

function TotalsRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 px-2.5 py-1 ${className || ""}`}>
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
      {children}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  step = "1",
  className,
  widthClassName = "w-20",
  title,
  blankWhenZero = false,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: string;
  className?: string;
  widthClassName?: string;
  title?: string;
  blankWhenZero?: boolean;
}) {
  return (
    <input
      type="number"
      step={step}
      value={blankWhenZero && value === 0 ? "" : value}
      onChange={(e) =>
        onChange(e.target.value === "" ? 0 : Number(e.target.value) || 0)
      }
      title={title}
      className={`${widthClassName} rounded border border-gray-300 bg-white px-1.5 py-0.5 text-right text-[11px] text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className || ""}`}
    />
  );
}
