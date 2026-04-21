"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Printer, RotateCcw, Save, X } from "lucide-react";

type CompanyInfo = {
  companyName: string;
  phoneNumber: string | null;
  address: string | null;
  logoUrl: string;
};

type JobOption = {
  id: string;
  dealId: string | null;
  dealName: string | null;
  address: string | null;
  status: string;
};

type ClientOption = {
  id: string;
  displayName: string;
  pipedriveId: string | null;
  contractor: string | null;
  customerAddress: string | null;
  jobs: JobOption[];
};

type LedStripRow = {
  id: string;
  room: string;
  lnFt: string;
  ledType: string;
  controlType: string;
  profile: string;
  profileQty: string;
  subtotal: string;
};

type OptionKey =
  | "LED_STRIP"
  | "LED_SHEET"
  | "MIRROR"
  | "GLASS_DOOR_SHELF"
  | "ISLAND_PANEL"
  | "WALL_UNIT"
  | "MIRROR_FRAME";

const OPTION_LABELS: Array<{ key: OptionKey; label: string }> = [
  { key: "LED_STRIP", label: "LED Strip" },
  { key: "LED_SHEET", label: "LED Sheet" },
  { key: "MIRROR", label: "Mirror" },
  { key: "GLASS_DOOR_SHELF", label: "Glass Door/Shelf" },
  { key: "ISLAND_PANEL", label: "Island Panel" },
  { key: "WALL_UNIT", label: "Wall Unit" },
  { key: "MIRROR_FRAME", label: "Mirror Frame" },
];

function makeRow(index: number): LedStripRow {
  return {
    id: `row-${Date.now()}-${index}`,
    room: "",
    lnFt: "",
    ledType: "",
    controlType: "",
    profile: "",
    profileQty: "",
    subtotal: "",
  };
}

interface Props {
  initialCompanyInfo: CompanyInfo;
  initialSalesRep: string;
}

type LoadedMetadata = {
  estimateNumber?: string;
  title?: string;
  customerId?: string;
  customerName?: string;
  customerPipedriveId?: string | null;
  jobId?: string;
  dealId?: string | null;
  dealName?: string | null;
  address?: string | null;
  contractor?: string | null;
  date?: string;
  salesRep?: string;
  selectedOptions?: OptionKey[];
  ledStripRows?: Array<{
    room?: string;
    lnFt?: number | null;
    ledType?: string;
    controlType?: string;
    profile?: string;
    profileQty?: number | null;
    subtotal?: number | null;
  }>;
};

export default function MiscEstimatesClient({
  initialCompanyInfo,
  initialSalesRep,
}: Props) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("Miscellaneous Estimate");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [loadingClientSearch, setLoadingClientSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    null,
  );
  const [selectedJobId, setSelectedJobId] = useState("");
  const [estimateNumber, setEstimateNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [salesRep, setSalesRep] = useState(initialSalesRep);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const [ledStripRows, setLedStripRows] = useState<LedStripRow[]>([
    makeRow(1),
    makeRow(2),
    makeRow(3),
  ]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sourceEstimateNumber, setSourceEstimateNumber] = useState<
    string | null
  >(null);

  const clientInputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Recalculate dropdown position whenever results appear, and on scroll/resize
  useEffect(() => {
    if (clientResults.length === 0) {
      setDropdownRect(null);
      return;
    }
    function measure() {
      const rect = clientInputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownRect({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [clientResults]);

  const selectedJob = useMemo(
    () => selectedClient?.jobs.find((j) => j.id === selectedJobId) ?? null,
    [selectedClient, selectedJobId],
  );

  const inferredContractor = selectedClient?.contractor?.trim() || null;

  const ledStripSubtotal = useMemo(
    () =>
      ledStripRows.reduce((sum, row) => {
        const value = Number(row.subtotal || 0);
        if (!Number.isFinite(value)) return sum;
        return sum + value;
      }, 0),
    [ledStripRows],
  );

  async function searchClients(input: string) {
    setClientSearch(input);
    setSaveError(null);

    if (input.trim().length < 2) {
      setClientResults([]);
      return;
    }

    setLoadingClientSearch(true);
    try {
      const response = await fetch(
        `/api/misc-estimates/lookup?q=${encodeURIComponent(input)}`,
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to lookup clients");
      }
      setClientResults(Array.isArray(json.results) ? json.results : []);
    } catch (error: any) {
      setSaveError(error?.message || "Failed to lookup clients");
    } finally {
      setLoadingClientSearch(false);
    }
  }

  function handlePickClient(client: ClientOption) {
    setSelectedClient(client);
    setClientSearch(client.displayName);
    const firstJob = client.jobs[0];
    setSelectedJobId(firstJob?.id || "");
    setClientResults([]);
  }

  function toggleOption(option: OptionKey) {
    setSelectedOptions((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option],
    );
  }

  function updateLedStripRow(id: string, patch: Partial<LedStripRow>) {
    setLedStripRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addLedStripRow() {
    setLedStripRows((prev) => [...prev, makeRow(prev.length + 1)]);
  }

  function removeLedStripRow(id: string) {
    setLedStripRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  useEffect(() => {
    const estimateId = searchParams.get("estimateId")?.trim();
    if (!estimateId) return;

    async function loadEstimate() {
      setSaveMessage(null);
      setSaveError(null);
      try {
        const response = await fetch(
          `/api/misc-estimates?id=${encodeURIComponent(estimateId)}`,
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Failed to load estimate");
        }

        const meta = (json?.metadata ?? {}) as LoadedMetadata;
        const loadedJobId = meta.jobId ?? "";
        const loadedDealName = meta.dealName ?? null;
        const loadedDealId = meta.dealId ?? null;

        setTitle(meta.title || "Miscellaneous Estimate");
        setEstimateNumber(meta.estimateNumber || "");
        setDate(meta.date || new Date().toISOString().slice(0, 10));
        setSalesRep(meta.salesRep || initialSalesRep);
        setSelectedOptions(
          Array.isArray(meta.selectedOptions) ? meta.selectedOptions : [],
        );

        const mappedRows = Array.isArray(meta.ledStripRows)
          ? meta.ledStripRows.map((row, index) => ({
              id: `loaded-${index}-${Date.now()}`,
              room: row.room ?? "",
              lnFt:
                typeof row.lnFt === "number" && Number.isFinite(row.lnFt)
                  ? String(row.lnFt)
                  : "",
              ledType: row.ledType ?? "",
              controlType: row.controlType ?? "",
              profile: row.profile ?? "",
              profileQty:
                typeof row.profileQty === "number" &&
                Number.isFinite(row.profileQty)
                  ? String(row.profileQty)
                  : "",
              subtotal:
                typeof row.subtotal === "number" &&
                Number.isFinite(row.subtotal)
                  ? String(row.subtotal)
                  : "",
            }))
          : [];
        setLedStripRows(
          mappedRows.length > 0
            ? mappedRows
            : [makeRow(1), makeRow(2), makeRow(3)],
        );

        const selected: ClientOption = {
          id: meta.customerId || "",
          displayName: meta.customerName || "-",
          pipedriveId: meta.customerPipedriveId || null,
          contractor: meta.contractor || null,
          customerAddress: meta.address || null,
          jobs: [
            {
              id: loadedJobId,
              dealId: loadedDealId,
              dealName: loadedDealName,
              address: meta.address || null,
              status: "LOADED",
            },
          ].filter((job) => Boolean(job.id)),
        };

        if (selected.id) {
          setSelectedClient(selected);
          setClientSearch(selected.displayName);
          setSelectedJobId(loadedJobId);
        }

        const mode = searchParams.get("mode")?.toLowerCase();
        setSourceEstimateNumber(
          mode === "edit" ? meta.estimateNumber?.trim() || null : null,
        );
        setSaveMessage(
          mode === "edit"
            ? `Loaded ${meta.estimateNumber || "estimate"} as editable copy.`
            : `Loaded ${meta.estimateNumber || "saved estimate"}.`,
        );
      } catch (error: any) {
        setSaveError(error?.message || "Failed to load estimate");
      }
    }

    void loadEstimate();
  }, [initialSalesRep, searchParams]);

  function handlePrint() {
    window.print();
  }

  function handleReset() {
    const shouldReset = window.confirm(
      "Reset this estimate? All unsaved changes will be lost.",
    );
    if (!shouldReset) return;

    setTitle("Miscellaneous Estimate");
    setClientSearch("");
    setClientResults([]);
    setSelectedClient(null);
    setSelectedJobId("");
    setEstimateNumber("");
    setDate(new Date().toISOString().slice(0, 10));
    setSalesRep(initialSalesRep);
    setSelectedOptions([]);
    setLedStripRows([makeRow(1), makeRow(2), makeRow(3)]);
    setSourceEstimateNumber(null);
    setSaveMessage(null);
    setSaveError(null);
  }

  async function saveEstimate() {
    setSaveMessage(null);
    setSaveError(null);

    if (!selectedClient) {
      setSaveError("Please select a client first.");
      return;
    }

    if (!selectedJob) {
      setSaveError("Please select a deal for this estimate.");
      return;
    }

    setSaveLoading(true);
    try {
      const payload = {
        title,
        customerId: selectedClient.id,
        customerName: selectedClient.displayName,
        customerPipedriveId: selectedClient.pipedriveId,
        jobId: selectedJob.id,
        dealId: selectedJob.dealId,
        dealName: selectedJob.dealName,
        address: selectedJob.address,
        contractor: inferredContractor,
        date,
        salesRep,
        selectedOptions,
        sourceEstimateNumber,
        ledStripRows: ledStripRows.map((row) => ({
          room: row.room,
          lnFt: row.lnFt ? Number(row.lnFt) : null,
          ledType: row.ledType,
          controlType: row.controlType,
          profile: row.profile,
          profileQty: row.profileQty ? Number(row.profileQty) : null,
          subtotal: row.subtotal ? Number(row.subtotal) : null,
        })),
        ledStripSubtotal,
      };

      const response = await fetch("/api/misc-estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to save estimate");
      }

      setEstimateNumber(String(json.estimateNumber || ""));
      setSaveMessage("Estimate saved successfully.");
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save estimate");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div
      id="print-area"
      className="misc-estimate-print space-y-6 print:space-y-1"
    >
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Miscellaneous Estimate
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={saveEstimate}
            disabled={saveLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
          >
            {saveLoading ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Estimate
              </>
            )}
          </button>
        </div>
      </div>

      <section className="misc-print-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 print:border print:border-gray-900 print:rounded-none print:p-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:grid-cols-12 print:gap-2 items-stretch">
          <div className="lg:col-span-7 print:col-span-8 border border-gray-300 dark:border-gray-600 rounded-lg p-4 print:border-gray-900 print:p-2">
            <div className="flex gap-4 items-stretch min-h-[118px]">
              <div className="w-48 h-auto relative bg-white rounded border border-gray-200 overflow-hidden flex-shrink-0">
                <Image
                  src={initialCompanyInfo.logoUrl || "/logo.svg"}
                  alt={initialCompanyInfo.companyName}
                  fill
                  className="object-contain p-2"
                />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {initialCompanyInfo.companyName}
                </p>
                {initialCompanyInfo.phoneNumber && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {initialCompanyInfo.phoneNumber}
                  </p>
                )}
                {initialCompanyInfo.address && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {initialCompanyInfo.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 print:col-span-4 border border-gray-300 dark:border-gray-600 rounded-lg p-4 print:border-gray-900 print:p-2 space-y-3 print:space-y-2">
            <div className="grid grid-cols-2 gap-3 print:gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Estimate #
                </label>
                <input
                  value={estimateNumber}
                  readOnly
                  placeholder="Generated after Save"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Sales Rep
              </label>
              <input
                value={salesRep}
                onChange={(event) => setSalesRep(event.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Client search in its own section so the dropdown is never clipped by a parent card */}
      <section className="misc-print-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 print:border print:border-gray-900 print:rounded-none print:p-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:grid-cols-12 print:gap-2">
          <div className="lg:col-span-8 print:col-span-4 space-y-3 print:space-y-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>

            <div className="relative">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Client (PD ID, Name, Deal, Address, Contractor)
              </label>
              <input
                ref={clientInputRef}
                value={clientSearch}
                onChange={(event) => searchClients(event.target.value)}
                placeholder="Type client name, PD ID, deal name or deal ID"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              {loadingClientSearch && (
                <p className="text-xs text-gray-500 mt-1">Searching...</p>
              )}
              {clientResults.length > 0 && dropdownRect && (
                <div
                  style={{
                    position: "fixed",
                    top: dropdownRect.top + 4,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                    zIndex: 9999,
                  }}
                  className="misc-print-hide bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl max-h-72 overflow-auto"
                >
                  {clientResults.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handlePickClient(client)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {client.displayName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PD: {client.pipedriveId || "-"} · Deals:{" "}
                        {client.jobs.length}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedClient && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-gray-300 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/40 print:hidden">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Client PD ID
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {selectedClient.pipedriveId || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Client Name
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {selectedClient.displayName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Deal ID & Name
                  </p>
                  <select
                    value={selectedJobId}
                    onChange={(event) => setSelectedJobId(event.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    {selectedClient.jobs.length === 0 && (
                      <option value="">No deals found</option>
                    )}
                    {selectedClient.jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.dealId || "-"} · {job.dealName || "Untitled deal"}{" "}
                        · {job.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Address
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {selectedJob?.address ||
                      selectedClient.customerAddress ||
                      "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Contractor
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {inferredContractor || "-"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="hidden print:block print:col-span-4 border border-gray-900 rounded-none p-2 bg-white">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Client Info
            </p>
            <div className="space-y-1.5 text-sm text-gray-900">
              <p>
                <span className="font-semibold">Client PD ID:</span>{" "}
                {selectedClient?.pipedriveId || "-"}
              </p>
              <p>
                <span className="font-semibold">Client Name:</span>{" "}
                {selectedClient?.displayName || "-"}
              </p>
              <p>
                <span className="font-semibold">Deal:</span>{" "}
                {selectedJob?.dealId || "-"} - {selectedJob?.dealName || "-"} (
                {selectedJob?.status || "-"})
              </p>
              <p>
                <span className="font-semibold">Address:</span>{" "}
                {selectedJob?.address || selectedClient?.customerAddress || "-"}
              </p>
              <p>
                <span className="font-semibold">Contractor:</span>{" "}
                {inferredContractor || "-"}
              </p>
            </div>
          </div>

          <div className="lg:col-span-4 print:col-span-4 border border-gray-300 dark:border-gray-600 rounded-lg p-3 print:border-gray-900 print:p-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Estimate Sections
            </p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3">
              {OPTION_LABELS.map((item) => (
                <label
                  key={item.key}
                  className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(item.key)}
                    onChange={() => toggleOption(item.key)}
                    className="rounded border-gray-400"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {(saveMessage || saveError) && (
          <div className="mt-4 print:hidden">
            {saveMessage && (
              <p className="text-sm text-green-700 dark:text-green-300 inline-flex items-center gap-1">
                <Check className="w-4 h-4" />
                {saveMessage}
              </p>
            )}
            {saveError && (
              <p className="text-sm text-red-600 dark:text-red-300">
                {saveError}
              </p>
            )}
          </div>
        )}
      </section>

      {selectedOptions.includes("LED_STRIP") && (
        <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
          <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold">
            LED STRIP
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse print:min-w-0">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-900">
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                    Del
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                    Room
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                    Ln.Ft.
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                    LED Type
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                    Control Type
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                    Profile
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                    Profile Qty
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledStripRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => removeLedStripRow(row.id)}
                        disabled={ledStripRows.length <= 1}
                        title="Delete row"
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        value={row.room}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            room: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.lnFt}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            lnFt: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        value={row.ledType}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            ledType: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        value={row.controlType}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            controlType: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        value={row.profile}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            profile: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.profileQty}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            profileQty: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.subtotal}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            subtotal: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                  <td className="border border-gray-300 dark:border-gray-700 p-2">
                    <button
                      type="button"
                      onClick={addLedStripRow}
                      className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                    >
                      <Plus className="w-3 h-3" />
                      Add Row
                    </button>
                  </td>
                  <td
                    className="border border-gray-300 dark:border-gray-700 p-2"
                    colSpan={5}
                  />
                  <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                    $
                    {ledStripSubtotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
