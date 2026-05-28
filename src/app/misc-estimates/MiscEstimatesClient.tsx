"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Printer, RotateCcw, Save, X } from "lucide-react";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type CompanyInfo = {
  companyName: string;
  phoneNumber: string | null;
  email: string | null;
  website: string | null;
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
  roomId: string;
  linearFeet: string;
  ledTypeId: string;
  controlTypeId: string;
  profileId: string;
  profileQty: string;
};

type RoomOption = {
  id: string;
  name: string;
  active: boolean;
};

type LedTypeOption = {
  id: string;
  name: string;
  minimumPriceUnder25Ft: number;
  pricePerFt: number;
  active: boolean;
};

type ControlTypeOption = {
  id: string;
  name: string;
  unitPrice: number;
  active: boolean;
};

type ProfileOption = {
  id: string;
  name: string;
  unitPrice: number;
  groovePricePerFt: number;
  active: boolean;
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
    roomId: "",
    linearFeet: "",
    ledTypeId: "",
    controlTypeId: "",
    profileId: "",
    profileQty: "",
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
    roomId?: string | null;
    room?: string;
    linearFeet?: number | null;
    lnFt?: number | null;
    ledTypeId?: string | null;
    ledType?: string;
    controlTypeId?: string | null;
    controlType?: string;
    profileId?: string | null;
    profile?: string;
    profileQty?: number | null;
    subtotal?: number | null;
  }>;
};

function RollingCurrency({
  value,
  withDollarSign = false,
}: {
  value: number;
  withDollarSign?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [incomingValue, setIncomingValue] = useState<number | null>(null);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === displayValue) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setDirection(value > displayValue ? "up" : "down");
    setIncomingValue(value);

    timeoutRef.current = setTimeout(() => {
      setDisplayValue(value);
      setIncomingValue(null);
      timeoutRef.current = null;
    }, 320);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, displayValue]);

  const currentText = CURRENCY_FORMATTER.format(displayValue);
  const incomingText =
    incomingValue === null ? "" : CURRENCY_FORMATTER.format(incomingValue);
  const animationClass =
    incomingValue === null
      ? ""
      : direction === "up"
        ? "rolling-value--up"
        : "rolling-value--down";

  return (
    <span className="inline-flex items-center justify-end gap-0.5">
      {withDollarSign && <span>$</span>}
      <span className={`rolling-value ${animationClass}`}>
        <span className="rolling-value__line rolling-value__line--current">
          {currentText}
        </span>
        {incomingValue !== null && (
          <span className="rolling-value__line rolling-value__line--incoming">
            {incomingText}
          </span>
        )}
      </span>
    </span>
  );
}

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
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [ledTypes, setLedTypes] = useState<LedTypeOption[]>([]);
  const [controlTypes, setControlTypes] = useState<ControlTypeOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
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

  useEffect(() => {
    async function loadLedSettings() {
      try {
        const response = await fetch("/api/misc-estimates/settings/led");
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Failed to load LED settings");
        }

        setRooms(Array.isArray(json?.rooms) ? json.rooms : []);
        setLedTypes(Array.isArray(json?.ledTypes) ? json.ledTypes : []);
        setControlTypes(
          Array.isArray(json?.controlTypes) ? json.controlTypes : [],
        );
        setProfiles(Array.isArray(json?.profiles) ? json.profiles : []);
      } catch (error: any) {
        setSaveError(error?.message || "Failed to load LED settings");
      }
    }

    void loadLedSettings();
  }, []);

  const selectedJob = useMemo(
    () => selectedClient?.jobs.find((j) => j.id === selectedJobId) ?? null,
    [selectedClient, selectedJobId],
  );

  const inferredContractor = selectedClient?.contractor?.trim() || null;

  const ledTypeById = useMemo(
    () => new Map(ledTypes.map((item) => [item.id, item])),
    [ledTypes],
  );
  const controlTypeById = useMemo(
    () => new Map(controlTypes.map((item) => [item.id, item])),
    [controlTypes],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );

  const roomNameToId = useMemo(
    () =>
      new Map(rooms.map((item) => [item.name.trim().toLowerCase(), item.id])),
    [rooms],
  );
  const ledTypeNameToId = useMemo(
    () =>
      new Map(
        ledTypes.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [ledTypes],
  );
  const controlNameToId = useMemo(
    () =>
      new Map(
        controlTypes.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [controlTypes],
  );
  const profileNameToId = useMemo(
    () =>
      new Map(
        profiles.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [profiles],
  );

  function toNumber(value: string) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isProfileYes(row: LedStripRow) {
    const selectedName = profileById
      .get(row.profileId)
      ?.name?.trim()
      .toLowerCase();
    return selectedName === "yes";
  }

  function getComputedProfileQty(row: LedStripRow) {
    const linearFeet = toNumber(row.linearFeet);
    if (!isProfileYes(row) || linearFeet <= 0) {
      return 0;
    }
    return Math.ceil(linearFeet / 8);
  }

  function getRowSubtotal(row: LedStripRow) {
    const linearFeet = toNumber(row.linearFeet);
    const profileQty = getComputedProfileQty(row);
    const profileEnabled = isProfileYes(row);
    const minimumTypePrice =
      ledTypeById.get(row.ledTypeId)?.minimumPriceUnder25Ft || 0;
    const typePrice = ledTypeById.get(row.ledTypeId)?.pricePerFt || 0;
    const groovePricePerFt =
      profileById.get(row.profileId)?.groovePricePerFt || 0;
    const profilePrice = profileById.get(row.profileId)?.unitPrice || 0;
    const ledBasePrice =
      linearFeet <= 0
        ? 0
        : linearFeet <= 25
          ? minimumTypePrice
          : minimumTypePrice + (linearFeet - 25) * typePrice;
    const profileAndGrooveCharge = profileEnabled
      ? profileQty * profilePrice + linearFeet * groovePricePerFt
      : 0;
    return ledBasePrice + profileAndGrooveCharge;
  }

  const ledStripSubtotal = useMemo(
    () => ledStripRows.reduce((sum, row) => sum + getRowSubtotal(row), 0),
    [ledStripRows, ledTypeById, controlTypeById, profileById],
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
    const rawEstimateId = searchParams.get("estimateId");
    if (!rawEstimateId) return;
    const estimateId = rawEstimateId.trim();
    if (!estimateId) return;

    async function loadEstimate() {
      setSaveMessage(null);
      setSaveError(null);
      try {
        const response = await fetch(
          `/api/misc-estimates/${encodeURIComponent(estimateId)}`,
        );
        let json = await response.json();
        if (!response.ok) {
          const fallbackResponse = await fetch(
            `/api/misc-estimates?id=${encodeURIComponent(estimateId)}`,
          );
          json = await fallbackResponse.json();
          if (!fallbackResponse.ok) {
            throw new Error(json?.error || "Failed to load estimate");
          }
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
              roomId:
                row.roomId ||
                (row.room
                  ? roomNameToId.get(row.room.trim().toLowerCase()) || ""
                  : ""),
              linearFeet:
                typeof (row.linearFeet ?? row.lnFt) === "number" &&
                Number.isFinite(row.linearFeet ?? row.lnFt)
                  ? String(row.linearFeet ?? row.lnFt)
                  : "",
              ledTypeId:
                row.ledTypeId ||
                (row.ledType
                  ? ledTypeNameToId.get(row.ledType.trim().toLowerCase()) || ""
                  : ""),
              controlTypeId:
                row.controlTypeId ||
                (row.controlType
                  ? controlNameToId.get(row.controlType.trim().toLowerCase()) ||
                    ""
                  : ""),
              profileId:
                row.profileId ||
                (row.profile
                  ? profileNameToId.get(row.profile.trim().toLowerCase()) || ""
                  : ""),
              profileQty:
                typeof row.profileQty === "number" &&
                Number.isFinite(row.profileQty)
                  ? String(row.profileQty)
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
  }, [
    initialSalesRep,
    searchParams,
    roomNameToId,
    ledTypeNameToId,
    controlNameToId,
    profileNameToId,
  ]);

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
          roomId: row.roomId || null,
          linearFeet: row.linearFeet ? Number(row.linearFeet) : null,
          ledTypeId: row.ledTypeId || null,
          controlTypeId: row.controlTypeId || null,
          profileId: row.profileId || null,
          profileQty: getComputedProfileQty(row),
          subtotal: getRowSubtotal(row),
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
                {initialCompanyInfo.email && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {initialCompanyInfo.email}
                  </p>
                )}
                {initialCompanyInfo.website && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {initialCompanyInfo.website}
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
                      <select
                        value={row.roomId}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            roomId: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      >
                        <option value="">Select room</option>
                        {rooms.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.linearFeet}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            linearFeet: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <select
                        value={row.ledTypeId}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            ledTypeId: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      >
                        <option value="">Select LED type</option>
                        {ledTypes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <select
                        value={row.controlTypeId}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            controlTypeId: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      >
                        <option value="">Select control type</option>
                        {controlTypes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <select
                        value={row.profileId}
                        onChange={(event) =>
                          updateLedStripRow(row.id, {
                            profileId: event.target.value,
                          })
                        }
                        className="w-full bg-transparent px-2 py-1 text-sm"
                      >
                        <option value="">Select profile</option>
                        {profiles.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        readOnly
                        value={getComputedProfileQty(row)}
                        className="w-full bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1">
                      <div className="w-full px-2 py-1 text-sm text-right">
                        <RollingCurrency value={getRowSubtotal(row)} />
                      </div>
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
                    <RollingCurrency value={ledStripSubtotal} withDollarSign />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="misc-print-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 print:border print:border-gray-900 print:rounded-none print:p-2">
        <div className="flex items-center justify-end gap-4 text-sm">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Estimate Total
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            <RollingCurrency value={ledStripSubtotal} withDollarSign />
          </span>
        </div>
      </section>
    </div>
  );
}
