"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, AlertTriangle, Save, Table2, Printer, RotateCcw } from "lucide-react";
import {
  computeAreaTotals,
  formatCurrency,
  type CalcAreaInput,
} from "@/lib/fabricationCalc";
import { parseFraction } from "@/lib/fractionInput";
import AreaImageUploader, {
  type ExistingImage,
  type PendingImage,
} from "./AreaImageUploader";
import Combobox from "./Combobox";

type Option = { id: string; name: string; [key: string]: unknown };

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

const STONE_THICKNESS_OPTIONS: { value: string; label: string }[] = [
  { value: "SIX_MM", label: "6mm" },
  { value: "EIGHT_MM", label: "8mm" },
  { value: "TEN_MM", label: "10mm" },
  { value: "TWELVE_MM", label: "12mm" },
  { value: "TWO_CM", label: "2cm" },
  { value: "THREE_CM", label: "3cm" },
];

const LEFTOVER_OPTIONS = ["None", "GMD", "Client"];
const QTY_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

const DEFAULT_ROWS_PER_TABLE = 5;

interface RowState {
  key: string;
  lengthIn: string;
  widthIn: string;
}

interface SectionState {
  key: string;
  edgeTypeId: string;
  rows: RowState[];
}

interface AreaState {
  key: string;
  id?: string;
  name: string;
  sinkTypeOptionId: string;
  sinkTypeText: string; // Model, only meaningful when sinkTypeOptionId is set
  sinkQty: string;
  faucetHas: boolean;
  faucetText: string; // Model, only meaningful when faucetHas is true
  stoneName: string;
  stoneThickness: string;
  whNumber: string;
  backsplashHas: boolean;
  backsplashIn: string;
  slabSupplierText: string;
  slabLengthIn: string;
  slabWidthIn: string;
  slabQty: string;
  slabTypeId: string;
  slabAmount: string;
  sinkCutoutOptionId: string;
  sinkCutoutQty: string;
  cooktopOptionId: string;
  cooktopQty: string;
  bumpOutOptionId: string;
  bumpOutQty: string;
  cuttingBoardOptionId: string;
  cuttingBoardQty: string;
  windowsillOptionId: string;
  powerStationOptionId: string;
  othersText: string;
  othersPrice: string;
  removalOptionId: string;
  leftoverNote: string;
  sections: SectionState[];
  existingImages: ExistingImage[];
  pendingImages: PendingImage[];
}

interface Props {
  currentUserName: string;
  edgeTypes: Option[];
  slabTypes: Option[];
  sinkCutouts: Option[];
  cooktops: Option[];
  bumpOuts: Option[];
  cuttingBoards: Option[];
  windowsills: Option[];
  powerStations: Option[];
  otherCharges: Option[];
  removals: Option[];
  slabSuppliers: Option[];
  stoneSuggestions: string[];
  sinkTypes: Option[];
}

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `k${Date.now()}${keyCounter}`;
}

function emptyRow(): RowState {
  return { key: nextKey(), lengthIn: "", widthIn: "" };
}

function emptySection(): SectionState {
  return {
    key: nextKey(),
    edgeTypeId: "",
    rows: Array.from({ length: DEFAULT_ROWS_PER_TABLE }, () => emptyRow()),
  };
}

function emptyArea(): AreaState {
  return {
    key: nextKey(),
    name: "",
    sinkTypeOptionId: "",
    sinkTypeText: "",
    sinkQty: "",
    faucetHas: false,
    faucetText: "",
    stoneName: "",
    stoneThickness: "",
    whNumber: "",
    backsplashHas: false,
    backsplashIn: "",
    slabSupplierText: "",
    slabLengthIn: "",
    slabWidthIn: "",
    slabQty: "0",
    slabTypeId: "",
    slabAmount: "0",
    sinkCutoutOptionId: "",
    sinkCutoutQty: "0",
    cooktopOptionId: "",
    cooktopQty: "0",
    bumpOutOptionId: "",
    bumpOutQty: "0",
    cuttingBoardOptionId: "",
    cuttingBoardQty: "0",
    windowsillOptionId: "",
    powerStationOptionId: "",
    othersText: "",
    othersPrice: "0",
    removalOptionId: "",
    leftoverNote: "None",
    sections: [emptySection()],
    existingImages: [],
    pendingImages: [],
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// slabAreaLabel is stored as free text like "1) 127 X 64 = 50.80" — the raw
// length/width inches aren't persisted as their own columns, so re-derive
// them on load. Without this, editing a saved order and re-saving without
// retyping the slab size would wipe the recommended-qty calculation.
function parseSlabAreaLabel(label: string | null | undefined): { length: string; width: string } {
  if (!label) return { length: "", width: "" };
  const match = label.match(/(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)/i);
  if (!match) return { length: "", width: "" };
  return { length: match[1], width: match[2] };
}

const fieldInput =
  "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
const compactInput =
  "w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
const fieldLabel = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";
const compactLabel = "block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5";
const card =
  "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 print:p-2 print:shadow-none print:border";
// Strips the native up/down spinner arrows from number inputs.
const noSpinner =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0";
const dividerClass = "hidden self-stretch w-px bg-gray-300 sm:block dark:bg-gray-600";

// Formats a raw numeric string as "$1,234.5" live, without forcing decimal
// places while the user is still typing them.
function formatLiveCurrency(raw: string): string {
  if (!raw) return "$0";
  const [intPart, decPart] = raw.split(".");
  const intNum = intPart ? parseInt(intPart, 10) : 0;
  const intFormatted = (Number.isFinite(intNum) ? intNum : 0).toLocaleString("en-US");
  return decPart !== undefined ? `$${intFormatted}.${decPart}` : `$${intFormatted}`;
}

function CurrencyInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={formatLiveCurrency(value)}
      onChange={(e) => {
        let cleaned = e.target.value.replace(/[^0-9.]/g, "");
        const firstDot = cleaned.indexOf(".");
        if (firstDot !== -1) {
          cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
        }
        onChange(cleaned);
      }}
      className={className}
    />
  );
}

export default function FabricationOrderForm(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editOrderId = searchParams.get("orderId");

  const [orderId, setOrderId] = useState<string | null>(editOrderId);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState(todayIso());
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientJobs, setClientJobs] = useState<LookupJob[]>([]);
  const [clientResults, setClientResults] = useState<LookupResult[]>([]);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearching, setClientSearching] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [dealId, setDealId] = useState("");
  const [dealName, setDealName] = useState("");
  const [salesRep, setSalesRep] = useState(props.currentUserName);
  const [notes, setNotes] = useState("");
  const [areas, setAreas] = useState<AreaState[]>([emptyArea()]);

  const [loading, setLoading] = useState(Boolean(editOrderId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientBoxRef = useRef<HTMLDivElement>(null);

  const edgeTypeById = useMemo(
    () => new Map(props.edgeTypes.map((e) => [e.id, e])),
    [props.edgeTypes],
  );
  const slabTypeById = useMemo(
    () => new Map(props.slabTypes.map((e) => [e.id, e])),
    [props.slabTypes],
  );
  const findPrice = (list: Option[], id: string) =>
    Number(list.find((o) => o.id === id)?.price ?? 0);

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

  // Live search the Customer Program as the user types.
  useEffect(() => {
    if (!clientDropdownOpen) return;
    const q = clientName.trim();
    if (q.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setClientSearching(true);
      try {
        const res = await fetch(`/api/fabrication-orders/lookup?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setClientResults(res.ok ? json.results || [] : []);
      } catch {
        setClientResults([]);
      } finally {
        setClientSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientName, clientDropdownOpen]);

  function selectClient(result: LookupResult) {
    setClientName(result.displayName);
    setClientId(result.id);
    setClientJobs(result.jobs || []);
    setSelectedJobId("");
    setDealId("");
    setDealName("");
    setClientDropdownOpen(false);
    setClientResults([]);
  }

  // The <select> below is controlled by the job's own id (so its value always
  // matches one of the rendered <option>s) — dealId/dealName are derived
  // separately and are what actually gets saved on the order.
  function selectJob(jobId: string) {
    setSelectedJobId(jobId);
    const job = clientJobs.find((j) => j.id === jobId);
    setDealId(job?.dealId || jobId || "");
    setDealName(job?.dealName || "");
  }

  useEffect(() => {
    if (!editOrderId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/fabrication-orders/${editOrderId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load order");

        setOrderNumber(json.orderNumber || "");
        setOrderDate(json.date ? String(json.date).slice(0, 10) : todayIso());
        setClientName(json.clientName || "");
        setClientId(json.clientId || "");
        setDealId(json.dealId || "");
        setDealName(json.dealName || "");
        setSalesRep(json.salesRep || "");
        setNotes(json.notes || "");
        setAreas(
          (json.areas || []).map((a: any) => {
            const slabSupplier = a.slabSupplierId
              ? props.slabSuppliers.find((s) => s.id === a.slabSupplierId)
              : null;
            const otherChargeOpt = a.otherChargeOptionId
              ? props.otherCharges.find((o) => o.id === a.otherChargeOptionId)
              : null;
            const slabDims = parseSlabAreaLabel(a.slabAreaLabel);
            return {
              key: nextKey(),
              id: a.id,
              name: a.name || "",
              sinkTypeOptionId: a.sinkTypeOptionId || "",
              sinkTypeText: a.sinkTypeText || "",
              sinkQty: a.sinkQty != null ? String(a.sinkQty) : "",
              faucetHas: Boolean(a.faucetText),
              faucetText: a.faucetText || "",
              stoneName: a.stoneName || "",
              stoneThickness: a.stoneThickness || "",
              whNumber: a.whNumber || "",
              backsplashHas: Boolean(a.backsplashHas),
              backsplashIn: a.backsplashIn != null ? String(a.backsplashIn) : "",
              slabSupplierText: slabSupplier?.name || a.slabSupplierCustomName || "",
              slabLengthIn: slabDims.length,
              slabWidthIn: slabDims.width,
              slabQty: a.slabQty != null ? String(a.slabQty) : "0",
              slabTypeId: a.slabTypeId || "",
              slabAmount: a.slabAmount != null ? String(a.slabAmount) : "0",
              sinkCutoutOptionId: a.sinkCutoutOptionId || "",
              sinkCutoutQty: a.sinkCutoutQty != null ? String(a.sinkCutoutQty) : "0",
              cooktopOptionId: a.cooktopOptionId || "",
              cooktopQty: a.cooktopQty != null ? String(a.cooktopQty) : "0",
              bumpOutOptionId: a.bumpOutOptionId || "",
              bumpOutQty: a.bumpOutQty != null ? String(a.bumpOutQty) : "0",
              cuttingBoardOptionId: a.cuttingBoardOptionId || "",
              cuttingBoardQty: a.cuttingBoardQty != null ? String(a.cuttingBoardQty) : "0",
              windowsillOptionId: a.windowsillOptionId || "",
              powerStationOptionId: a.powerStationOptionId || "",
              othersText: otherChargeOpt?.name || a.otherChargeCustomName || "",
              othersPrice:
                otherChargeOpt != null
                  ? String(Number(otherChargeOpt.price ?? 0))
                  : a.otherChargeCustomPrice != null
                    ? String(a.otherChargeCustomPrice)
                    : "0",
              removalOptionId: a.removalOptionId || "",
              leftoverNote: a.leftoverNote || "None",
              sections: (a.sections || []).length
                ? a.sections.map((s: any) => ({
                    key: nextKey(),
                    edgeTypeId: s.edgeTypeId || "",
                    rows: (s.rows || []).length
                      ? s.rows.map((r: any) => ({
                          key: nextKey(),
                          lengthIn: r.lengthIn != null ? String(r.lengthIn) : "",
                          widthIn: r.widthIn != null ? String(r.widthIn) : "",
                        }))
                      : [emptyRow()],
                  }))
                : [emptySection()],
              existingImages: (a.images || []).map((img: any) => ({
                id: img.id,
                fileUrl: img.fileUrl,
                caption: img.caption,
              })),
              pendingImages: [],
            };
          }),
        );

        // Best-effort: re-populate the Job/Deal dropdown for the linked customer.
        if (json.clientId && json.clientName) {
          try {
            const lookupRes = await fetch(
              `/api/fabrication-orders/lookup?q=${encodeURIComponent(json.clientName)}`,
            );
            const lookupJson = await lookupRes.json();
            const match = (lookupJson.results || []).find(
              (r: LookupResult) => r.id === json.clientId,
            );
            if (match) {
              setClientJobs(match.jobs || []);
              const matchedJob = (match.jobs || []).find(
                (j: LookupJob) => j.dealId === json.dealId,
              );
              if (matchedJob) setSelectedJobId(matchedJob.id);
            }
          } catch {
            // Non-critical — Job/Deal falls back to a plain text field.
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderId]);

  function updateArea(key: string, patch: Partial<AreaState>) {
    setAreas((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  // Used by the qty-driven Sales Price line items: picking an option bumps
  // the quantity to 1 the first time (it starts at 0 until something is
  // actually selected), without stomping a quantity the user already set.
  function selectLineItemOption(
    areaKey: string,
    optionField: "sinkCutoutOptionId" | "cooktopOptionId" | "bumpOutOptionId" | "cuttingBoardOptionId",
    qtyField: "sinkCutoutQty" | "cooktopQty" | "bumpOutQty" | "cuttingBoardQty",
    value: string,
    currentQty: string,
  ) {
    updateArea(areaKey, {
      [optionField]: value,
      [qtyField]: value && currentQty === "0" ? "1" : currentQty,
    } as Partial<AreaState>);
  }

  function addArea() {
    setAreas((prev) => [...prev, emptyArea()]);
  }

  function removeArea(key: string) {
    if (!confirm("Remove this area from the order?")) return;
    setAreas((prev) => prev.filter((a) => a.key !== key));
  }

  function addSection(areaKey: string) {
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey ? { ...a, sections: [...a.sections, emptySection()] } : a,
      ),
    );
  }

  function removeSection(areaKey: string, sectionKey: string) {
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? { ...a, sections: a.sections.filter((s) => s.key !== sectionKey) }
          : a,
      ),
    );
  }

  function updateSection(areaKey: string, sectionKey: string, patch: Partial<SectionState>) {
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? {
              ...a,
              sections: a.sections.map((s) =>
                s.key === sectionKey ? { ...s, ...patch } : s,
              ),
            }
          : a,
      ),
    );
  }

  function addRow(areaKey: string, sectionKey: string) {
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? {
              ...a,
              sections: a.sections.map((s) =>
                s.key === sectionKey ? { ...s, rows: [...s.rows, emptyRow()] } : s,
              ),
            }
          : a,
      ),
    );
  }

  function removeRow(areaKey: string, sectionKey: string, rowKey: string) {
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? {
              ...a,
              sections: a.sections.map((s) =>
                s.key === sectionKey
                  ? { ...s, rows: s.rows.filter((r) => r.key !== rowKey) }
                  : s,
              ),
            }
          : a,
      ),
    );
  }

  function updateRow(
    areaKey: string,
    sectionKey: string,
    rowKey: string,
    patch: Partial<RowState>,
  ) {
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? {
              ...a,
              sections: a.sections.map((s) =>
                s.key === sectionKey
                  ? {
                      ...s,
                      rows: s.rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)),
                    }
                  : s,
              ),
            }
          : a,
      ),
    );
  }

  function calcForArea(area: AreaState) {
    const calcInput: CalcAreaInput = {
      sections: area.sections.map((s) => {
        const edgeType = edgeTypeById.get(s.edgeTypeId);
        return {
          isBuildUp: Boolean(edgeType?.isBuildUp),
          pricePerSqft: Number(edgeType?.pricePerSqft ?? 0),
          rows: s.rows.map((r) => ({
            lengthIn: parseFraction(r.lengthIn),
            widthIn: parseFraction(r.widthIn),
          })),
        };
      }),
      slabTypeMultiplier: Number(slabTypeById.get(area.slabTypeId)?.multiplier ?? 1) || 1,
      sinkCutoutQty: num(area.sinkCutoutQty),
      sinkCutoutPrice: findPrice(props.sinkCutouts, area.sinkCutoutOptionId),
      cooktopQty: num(area.cooktopQty),
      cooktopPrice: findPrice(props.cooktops, area.cooktopOptionId),
      bumpOutQty: num(area.bumpOutQty),
      bumpOutPrice: findPrice(props.bumpOuts, area.bumpOutOptionId),
      cuttingBoardQty: num(area.cuttingBoardQty),
      cuttingBoardPrice: findPrice(props.cuttingBoards, area.cuttingBoardOptionId),
      windowsillPrice: area.windowsillOptionId
        ? findPrice(props.windowsills, area.windowsillOptionId)
        : 0,
      powerStationPrice: area.powerStationOptionId
        ? findPrice(props.powerStations, area.powerStationOptionId)
        : 0,
      otherChargePrice: num(area.othersPrice),
      removalPrice: area.removalOptionId
        ? findPrice(props.removals, area.removalOptionId)
        : 0,
      slabAmount: num(area.slabAmount),
      slabLengthIn: parseFraction(area.slabLengthIn),
      slabWidthIn: parseFraction(area.slabWidthIn),
      slabQty: num(area.slabQty),
    };
    return computeAreaTotals(calcInput);
  }

  const areaResults = areas.map((a) => calcForArea(a));
  const orderTotal = areaResults.reduce((sum, r) => sum + r.areaTotal, 0);

  function handlePrint() {
    window.print();
  }

  function handleReset() {
    if (!confirm("Reset this fabrication order sheet? Unsaved changes will be lost.")) return;
    setOrderId(null);
    setOrderNumber("");
    setOrderDate(todayIso());
    setClientName("");
    setClientId("");
    setClientJobs([]);
    setClientResults([]);
    setSelectedJobId("");
    setDealId("");
    setDealName("");
    setSalesRep(props.currentUserName);
    setNotes("");
    setAreas([emptyArea()]);
    setMessage(null);
    setError(null);
    router.replace("/fabrication-orders");
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!clientName.trim()) throw new Error("Client name is required.");
      if (!salesRep.trim()) throw new Error("Sales rep is required.");
      if (areas.length === 0) throw new Error("Add at least one area.");

      const payload = {
        date: orderDate,
        clientName: clientName.trim(),
        clientId: clientId || null,
        dealId: dealId || null,
        dealName: dealName || null,
        salesRep: salesRep.trim(),
        notes,
        areas: areas.map((a, idx) => {
          const supplierMatch = props.slabSuppliers.find(
            (s) => s.name.toLowerCase() === a.slabSupplierText.trim().toLowerCase(),
          );
          const othersMatch = props.otherCharges.find(
            (o) => o.name.toLowerCase() === a.othersText.trim().toLowerCase(),
          );
          const othersPriceMatches =
            othersMatch != null &&
            Math.abs(Number(othersMatch.price ?? 0) - num(a.othersPrice)) < 0.005;
          const usePresetOther = Boolean(othersMatch && othersPriceMatches);

          return {
            id: a.id,
            name: a.name.trim() || `Area ${idx + 1}`,
            sortOrder: idx,
            sinkTypeOptionId: a.sinkTypeOptionId || null,
            sinkTypeText: a.sinkTypeOptionId ? a.sinkTypeText : "",
            sinkQty: a.sinkTypeOptionId ? a.sinkQty : "",
            faucetText: a.faucetHas ? a.faucetText : "",
            stoneName: a.stoneName,
            stoneThickness: a.stoneThickness || null,
            whNumber: a.whNumber,
            backsplashHas: a.backsplashHas,
            backsplashIn: a.backsplashHas ? parseFraction(a.backsplashIn) : null,
            slabSupplierId: supplierMatch ? supplierMatch.id : null,
            slabSupplierCustomName: supplierMatch ? null : a.slabSupplierText.trim() || null,
            slabLengthIn: parseFraction(a.slabLengthIn),
            slabWidthIn: parseFraction(a.slabWidthIn),
            slabQty: num(a.slabQty),
            slabTypeId: a.slabTypeId || null,
            slabAmount: num(a.slabAmount),
            sinkCutoutOptionId: a.sinkCutoutOptionId || null,
            sinkCutoutQty: num(a.sinkCutoutQty),
            cooktopOptionId: a.cooktopOptionId || null,
            cooktopQty: num(a.cooktopQty),
            bumpOutOptionId: a.bumpOutOptionId || null,
            bumpOutQty: num(a.bumpOutQty),
            cuttingBoardOptionId: a.cuttingBoardOptionId || null,
            cuttingBoardQty: num(a.cuttingBoardQty),
            windowsillOptionId: a.windowsillOptionId || null,
            powerStationOptionId: a.powerStationOptionId || null,
            otherChargeOptionId: usePresetOther ? othersMatch!.id : null,
            otherChargeCustomName: usePresetOther ? null : a.othersText.trim() || null,
            otherChargeCustomPrice: usePresetOther ? null : num(a.othersPrice),
            removalOptionId: a.removalOptionId || null,
            leftoverNote: a.leftoverNote || "None",
            drawingMode: "IMAGE",
            canvasData: { shapes: [] },
            sections: a.sections.map((s, sIdx) => ({
              edgeTypeId: s.edgeTypeId || null,
              sortOrder: sIdx,
              rows: s.rows.map((r, rIdx) => ({
                lengthIn: parseFraction(r.lengthIn),
                widthIn: parseFraction(r.widthIn),
                sortOrder: rIdx,
              })),
            })),
            images: {
              keepIds: a.existingImages.map((img) => img.id),
              newImages: a.pendingImages.map((img) => ({
                dataUrl: img.dataUrl,
                caption: img.caption,
              })),
            },
          };
        }),
      };

      const res = await fetch(
        orderId ? `/api/fabrication-orders/${orderId}` : "/api/fabrication-orders",
        {
          method: orderId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save order");

      setMessage("Fabrication order saved.");
      if (!orderId && json.id) {
        setOrderId(json.id);
        if (json.orderNumber) setOrderNumber(json.orderNumber);
        router.replace(`/fabrication-orders?orderId=${json.id}`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save order");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading fabrication order...
      </div>
    );
  }

  return (
    <div className="fab-print-root space-y-6 pb-10 print:space-y-1 print:pb-0">
      <style>{`
        @media print {
          @page { margin: 6mm; }
          .fab-print-root, .fab-print-root * {
            font-size: 10px !important;
            line-height: 1.15 !important;
          }
          .fab-print-root h1 { font-size: 15px !important; }
          .fab-print-root h2, .fab-print-root h3 { font-size: 10px !important; }
          .fab-print-root .fab-area-name { font-size: 13px !important; }
          .fab-print-root input,
          .fab-print-root select,
          .fab-print-root textarea,
          .fab-print-root .fab-readout {
            padding: 0px 3px !important;
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            appearance: none !important;
          }
          /* Placeholder/watermark example text (e.g. "80 1/4", "Stone name")
             is on-screen typing guidance only — it must never render as if
             it were a real entered value on a printed order. The one
             exception is the Area name field: its placeholder ("Area N") is
             the actual fallback heading text when no custom name was typed,
             so it needs to stay visible. */
          .fab-print-root input::placeholder,
          .fab-print-root textarea::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }
          .fab-print-root .fab-area-name::placeholder {
            color: #4338ca !important;
            opacity: 1 !important;
          }
          .fab-print-root th,
          .fab-print-root td {
            padding: 0px 6px 0px 0px !important;
          }
          .fab-print-root .fab-area-card {
            break-inside: auto !important;
          }
          /* Bound each layout image to a fixed, predictable height rather
             than trying to match the (variable-height) Sales Price /
             Edge-Finish column. Both CSS Grid stretch and a JS-measured
             "match the sibling column's exact height" were tried and
             reverted — either made the box taller than the space actually
             left on page 1, so the whole Layout cell got kicked to its own
             page 2. A fixed, safely-bounded max-height (divided evenly via
             --print-img-count when there are multiple images) is what
             reliably keeps everything on one sheet. */
          .fab-print-root .fab-image-stack {
            display: block !important;
          }
          .fab-print-root .fab-image-stack > div {
            margin-bottom: 3px !important;
          }
          .fab-print-root .fab-image-stack img {
            max-height: calc(320px / var(--print-img-count, 1)) !important;
            height: auto !important;
            width: 100% !important;
            object-fit: contain !important;
          }
        }
      `}</style>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {orderId ? "Edit Fabrication Order" : "New Fabrication Order"}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Upload each area&apos;s layout, pick finishes, and the price calculates automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4" /> Save
              </>
            )}
          </button>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm print:hidden ${
            error
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
              : "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
          }`}
        >
          {error || message}
        </div>
      )}

      {/* ── TOP: compact client / job info ── */}
      <div className={`${card} border-t-4 border-t-blue-500 print:mb-1`}>
        <h2 className="mb-4 print:mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Client &amp; Job Information
        </h2>
        <div className="grid grid-cols-1 gap-4 print:gap-1 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2 lg:col-span-2" ref={clientBoxRef}>
            <label className={fieldLabel}>Customer Name</label>
            <input
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                setClientId("");
                setClientDropdownOpen(true);
              }}
              onFocus={() => setClientDropdownOpen(true)}
              className={fieldInput}
              placeholder="Search the Customer Program..."
              autoComplete="off"
            />
            {clientDropdownOpen && (clientSearching || clientResults.length > 0) && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {clientSearching && (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    Searching...
                  </div>
                )}
                {!clientSearching &&
                  clientResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectClient(r);
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {r.displayName}
                        </span>
                        {r.pipedriveId && (
                          <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                            PD #{r.pipedriveId}
                          </span>
                        )}
                      </div>
                      {(r.contractor || r.customerAddress) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {[r.contractor, r.customerAddress].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <div>
            <label className={fieldLabel}>Job / Deal</label>
            {clientJobs.length > 0 ? (
              <select
                value={selectedJobId}
                onChange={(e) => selectJob(e.target.value)}
                className={fieldInput}
              >
                <option value="">Select a job...</option>
                {clientJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.dealName || j.address || j.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                className={fieldInput}
                placeholder="Job / Deal name"
              />
            )}
          </div>
          <div>
            <label className={fieldLabel}>Sales Rep</label>
            <input
              value={salesRep}
              onChange={(e) => setSalesRep(e.target.value)}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>Date</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>FO #</label>
            <input
              disabled
              value={orderNumber || "Assigned on save"}
              className={`${fieldInput} disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed dark:disabled:bg-gray-900/40 dark:disabled:text-gray-500`}
            />
          </div>
        </div>

        <div className="mt-4 print:mt-1 flex items-end justify-between gap-4 border-t border-gray-100 pt-4 print:pt-1 dark:border-gray-700">
          <div className="max-w-md flex-1">
            <label className={fieldLabel}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldInput} />
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Order Total</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(orderTotal)}
            </div>
          </div>
        </div>
      </div>

      {areas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No areas yet. Add one to start pricing this job.
        </div>
      ) : (
        areas.map((area, areaIdx) => {
          const result = areaResults[areaIdx];
          const hasImages = area.existingImages.length > 0 || area.pendingImages.length > 0;
          return (
            <div
              key={area.key}
              className={`${card} fab-area-card space-y-4 print:space-y-1 border-t-4 border-t-indigo-400`}
            >
              <div className="flex items-center justify-between gap-4">
                <input
                  value={area.name}
                  onChange={(e) => updateArea(area.key, { name: e.target.value })}
                  className="fab-area-name w-64 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-base font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-indigo-300"
                  placeholder={`Area ${areaIdx + 1}`}
                />
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Area Total</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(result.areaTotal)}
                    </div>
                  </div>
                  {areas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArea(area.key)}
                      className="rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 print:hidden"
                      title="Remove area"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Compact info bar: slab + sink + faucet, 2 rows */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 print:p-1 dark:border-gray-700 dark:bg-gray-900/20">
                <div className="flex flex-wrap items-end gap-2 print:gap-1">
                  <div className="w-64">
                    <label className={compactLabel}>Stone Name</label>
                    <Combobox
                      value={area.stoneName}
                      onChange={(v) => updateArea(area.key, { stoneName: v })}
                      suggestions={props.stoneSuggestions}
                      className={compactInput}
                      placeholder="Stone name"
                    />
                  </div>
                  <div className="w-14">
                    <label className={compactLabel}>Slab Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={area.slabQty}
                      onChange={(e) => updateArea(area.key, { slabQty: e.target.value })}
                      className={`${compactInput} ${noSpinner} text-center`}
                    />
                  </div>
                  <div className="w-16">
                    <label className={compactLabel}>Length</label>
                    <input
                      value={area.slabLengthIn}
                      onChange={(e) => updateArea(area.key, { slabLengthIn: e.target.value })}
                      className={`${compactInput} text-center`}
                      placeholder={"80 1/4"}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="w-16">
                    <label className={compactLabel}>Width</label>
                    <input
                      value={area.slabWidthIn}
                      onChange={(e) => updateArea(area.key, { slabWidthIn: e.target.value })}
                      className={`${compactInput} text-center`}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="w-16">
                    <label className={compactLabel}>SqFt</label>
                    <div
                      className={`${compactInput} fab-readout bg-gray-100 text-center text-gray-600 dark:bg-gray-800 dark:text-gray-300`}
                    >
                      {result.slabPieceSqft > 0 ? result.slabPieceSqft.toFixed(2) : "-"}
                    </div>
                  </div>
                  <div className="w-64">
                    <label className={compactLabel}>Provider</label>
                    <Combobox
                      value={area.slabSupplierText}
                      onChange={(v) => updateArea(area.key, { slabSupplierText: v })}
                      suggestions={props.slabSuppliers.map((s) => s.name)}
                      className={compactInput}
                      placeholder="Type or select"
                    />
                  </div>
                  <div className="w-20">
                    <label className={compactLabel}>Thickness</label>
                    <select
                      value={area.stoneThickness}
                      onChange={(e) => updateArea(area.key, { stoneThickness: e.target.value })}
                      className={compactInput}
                    >
                      <option value="">-</option>
                      {STONE_THICKNESS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className={compactLabel}>Slab Type</label>
                    <select
                      value={area.slabTypeId}
                      onChange={(e) => updateArea(area.key, { slabTypeId: e.target.value })}
                      className={compactInput}
                    >
                      <option value="">-</option>
                      {props.slabTypes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-2 print:mt-1 flex flex-wrap items-end gap-2 print:gap-1">
                  <div className="w-20">
                    <label className={compactLabel}>Backsplash</label>
                    <select
                      value={area.backsplashHas ? "yes" : "no"}
                      onChange={(e) =>
                        updateArea(area.key, { backsplashHas: e.target.value === "yes" })
                      }
                      className={compactInput}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="w-16">
                    <label className={compactLabel}>Size (in)</label>
                    <input
                      value={area.backsplashIn}
                      onChange={(e) => updateArea(area.key, { backsplashIn: e.target.value })}
                      className={`${compactInput} text-center`}
                      inputMode="decimal"
                      disabled={!area.backsplashHas}
                    />
                  </div>

                  <div className={dividerClass} />

                  <div className="w-32">
                    <label className={compactLabel}>Sink Type</label>
                    <select
                      value={area.sinkTypeOptionId}
                      onChange={(e) =>
                        updateArea(area.key, {
                          sinkTypeOptionId: e.target.value,
                          ...(e.target.value ? {} : { sinkTypeText: "", sinkQty: "" }),
                        })
                      }
                      className={compactInput}
                    >
                      <option value="">None</option>
                      {props.sinkTypes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className={compactLabel}>Model</label>
                    <input
                      value={area.sinkTypeText}
                      onChange={(e) => updateArea(area.key, { sinkTypeText: e.target.value })}
                      className={compactInput}
                      disabled={!area.sinkTypeOptionId}
                    />
                  </div>
                  <div className="w-14">
                    <label className={compactLabel}>Sink Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={area.sinkQty}
                      onChange={(e) => updateArea(area.key, { sinkQty: e.target.value })}
                      className={`${compactInput} ${noSpinner} text-center`}
                      disabled={!area.sinkTypeOptionId}
                    />
                  </div>

                  <div className={dividerClass} />

                  <div className="w-20">
                    <label className={compactLabel}>Faucet</label>
                    <select
                      value={area.faucetHas ? "yes" : "no"}
                      onChange={(e) => updateArea(area.key, { faucetHas: e.target.value === "yes" })}
                      className={compactInput}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="w-28">
                    <label className={compactLabel}>Faucet Model</label>
                    <input
                      value={area.faucetText}
                      onChange={(e) => updateArea(area.key, { faucetText: e.target.value })}
                      className={compactInput}
                      disabled={!area.faucetHas}
                    />
                  </div>

                  <div className={dividerClass} />

                  <div className="w-20">
                    <label className={compactLabel}>WH #</label>
                    <input
                      value={area.whNumber}
                      onChange={(e) => updateArea(area.key, { whNumber: e.target.value })}
                      className={compactInput}
                    />
                  </div>
                </div>

                {result.slabPieceSqft > 0 && (
                  <div
                    className={`mt-2 print:mt-1 flex items-center gap-2 rounded-md p-2 print:p-1 text-xs ${
                      result.slabQtyFlagged
                        ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    }`}
                  >
                    {result.slabQtyFlagged && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                    Recommended slabs: <strong>{result.slabRecommendedQty}</strong> — job area is{" "}
                    {(result.jobSqft + result.buildUpSqft).toFixed(2)} sqft (plus 15% waste), and
                    each slab you entered covers {result.slabPieceSqft.toFixed(2)} sqft.{" "}
                    {result.slabQtyFlagged
                      ? "The quantity entered above looks insufficient."
                      : "The quantity entered above looks sufficient."}
                  </div>
                )}
              </div>

              {/* LEFT: layout image (half width) | RIGHT: sales price + edge/finish side by side */}
              <div
                className={`grid grid-cols-1 gap-4 xl:grid-cols-2 print:gap-1 print:items-start ${
                  hasImages ? "print:grid-cols-2" : "print:grid-cols-1"
                }`}
              >
                {/* LEFT: layout */}
                <div
                  className={`rounded-lg border border-gray-200 border-l-4 border-l-violet-400 p-3 dark:border-gray-700 print:p-1 ${
                    hasImages ? "" : "print:hidden"
                  }`}
                >
                  <h3 className="mb-2 print:mb-1 shrink-0 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    Layout
                  </h3>
                  <div>
                    <AreaImageUploader
                      existingImages={area.existingImages}
                      pendingImages={area.pendingImages}
                      onAddPending={(imgs) =>
                        updateArea(area.key, { pendingImages: [...area.pendingImages, ...imgs] })
                      }
                      onRemovePending={(idx) =>
                        updateArea(area.key, {
                          pendingImages: area.pendingImages.filter((_, i) => i !== idx),
                        })
                      }
                      onRemoveExisting={(id) =>
                        updateArea(area.key, {
                          existingImages: area.existingImages.filter((img) => img.id !== id),
                        })
                      }
                    />
                  </div>
                </div>

                {/* RIGHT: sales price + edge/finish tables, side by side */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 print:grid-cols-2 print:gap-1">
                  <div className="rounded-lg border border-gray-200 border-l-4 border-l-emerald-400 p-3 dark:border-gray-700 print:p-1">
                    <h3 className="mb-2 print:mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Sales Price
                    </h3>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 print:gap-y-0.5 text-xs">
                      <div className="col-span-2 flex justify-between border-b border-gray-100 pb-1 dark:border-gray-700">
                        <span className="text-gray-500 dark:text-gray-400">Job SqFt</span>
                        <strong>{result.jobSqft.toFixed(2)}</strong>
                      </div>
                      <div className="col-span-2 flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Slab Amount</span>
                        <CurrencyInput
                          value={area.slabAmount}
                          onChange={(v) => updateArea(area.key, { slabAmount: v })}
                          className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-xs dark:border-gray-600 dark:bg-gray-700"
                        />
                      </div>
                      <div className="col-span-2 flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Labor</span>
                        <strong>{formatCurrency(result.labor)}</strong>
                      </div>
                      <div className="col-span-2 flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Build-Up ({result.buildUpSqft.toFixed(2)} sqft)
                        </span>
                        <strong>{formatCurrency(result.buildUp)}</strong>
                      </div>

                      <LineItemCompact
                        label="Sink Cutout"
                        options={props.sinkCutouts}
                        optionId={area.sinkCutoutOptionId}
                        qty={area.sinkCutoutQty}
                        onOptionChange={(v) =>
                          selectLineItemOption(
                            area.key,
                            "sinkCutoutOptionId",
                            "sinkCutoutQty",
                            v,
                            area.sinkCutoutQty,
                          )
                        }
                        onQtyChange={(v) => updateArea(area.key, { sinkCutoutQty: v })}
                        total={result.sinkCutoutTotal}
                      />
                      <LineItemCompact
                        label="Cooktop"
                        options={props.cooktops}
                        optionId={area.cooktopOptionId}
                        qty={area.cooktopQty}
                        onOptionChange={(v) =>
                          selectLineItemOption(
                            area.key,
                            "cooktopOptionId",
                            "cooktopQty",
                            v,
                            area.cooktopQty,
                          )
                        }
                        onQtyChange={(v) => updateArea(area.key, { cooktopQty: v })}
                        total={result.cooktopTotal}
                      />
                      <LineItemCompact
                        label="Bump Out"
                        options={props.bumpOuts}
                        optionId={area.bumpOutOptionId}
                        qty={area.bumpOutQty}
                        onOptionChange={(v) =>
                          selectLineItemOption(
                            area.key,
                            "bumpOutOptionId",
                            "bumpOutQty",
                            v,
                            area.bumpOutQty,
                          )
                        }
                        onQtyChange={(v) => updateArea(area.key, { bumpOutQty: v })}
                        total={result.bumpOutTotal}
                      />
                      <LineItemCompact
                        label="Cutting Board"
                        options={props.cuttingBoards}
                        optionId={area.cuttingBoardOptionId}
                        qty={area.cuttingBoardQty}
                        onOptionChange={(v) =>
                          selectLineItemOption(
                            area.key,
                            "cuttingBoardOptionId",
                            "cuttingBoardQty",
                            v,
                            area.cuttingBoardQty,
                          )
                        }
                        onQtyChange={(v) => updateArea(area.key, { cuttingBoardQty: v })}
                        total={result.cuttingBoardTotal}
                      />
                      <LineItemFlatCompact
                        label="Windowsill"
                        options={props.windowsills}
                        optionId={area.windowsillOptionId}
                        onOptionChange={(v) => updateArea(area.key, { windowsillOptionId: v })}
                        total={result.windowsillTotal}
                      />
                      <LineItemFlatCompact
                        label="Power Station"
                        options={props.powerStations}
                        optionId={area.powerStationOptionId}
                        onOptionChange={(v) => updateArea(area.key, { powerStationOptionId: v })}
                        total={result.powerStationTotal}
                      />

                      <div className="col-span-2 grid grid-cols-[1fr_60px] items-end gap-1.5">
                        <div>
                          <label className={compactLabel}>Others</label>
                          <Combobox
                            value={area.othersText}
                            onChange={(v) => updateArea(area.key, { othersText: v })}
                            onSelect={(name) => {
                              const match = props.otherCharges.find((o) => o.name === name);
                              updateArea(area.key, {
                                othersText: name,
                                othersPrice: String(Number(match?.price ?? 0)),
                              });
                            }}
                            suggestions={props.otherCharges.map((o) => o.name)}
                            className={compactInput}
                            placeholder="Type or select"
                          />
                        </div>
                        <CurrencyInput
                          value={area.othersPrice}
                          onChange={(v) => updateArea(area.key, { othersPrice: v })}
                          className="w-full rounded-md border border-gray-300 bg-white px-1.5 py-1.5 text-right text-xs dark:border-gray-600 dark:bg-gray-700"
                        />
                      </div>

                      <LineItemFlatCompact
                        label="Removal"
                        options={props.removals}
                        optionId={area.removalOptionId}
                        onOptionChange={(v) => updateArea(area.key, { removalOptionId: v })}
                        total={result.removalTotal}
                      />

                      <div className="col-span-2">
                        <label className={compactLabel}>Leftover</label>
                        <select
                          value={area.leftoverNote}
                          onChange={(e) => updateArea(area.key, { leftoverNote: e.target.value })}
                          className={compactInput}
                        >
                          {LEFTOVER_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 flex justify-between border-t-2 border-gray-200 pt-2 text-sm dark:border-gray-600">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Area Total</span>
                        <strong className="text-base">{formatCurrency(result.areaTotal)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 print:space-y-1">
                  {/* Length x Width tables */}
                  {area.sections.map((section) => {
                    const edgeType = edgeTypeById.get(section.edgeTypeId);
                    const sectionSqft = section.rows.reduce((sum, r) => {
                      const l = parseFraction(r.lengthIn);
                      const w = parseFraction(r.widthIn);
                      return l > 0 && w > 0 ? sum + (l * w) / 144 : sum;
                    }, 0);
                    return (
                      <div
                        key={section.key}
                        className="rounded-lg border border-gray-200 border-l-4 border-l-amber-400 p-3 print:p-1 dark:border-gray-700"
                      >
                        <div className="mb-2 print:mb-1 flex flex-wrap items-end justify-between gap-2">
                          <div className="flex-1 min-w-[160px]">
                            <label className="block text-[11px] font-medium text-amber-600 dark:text-amber-400 mb-0.5">
                              Edge / Finish{" "}
                              {edgeType?.isBuildUp ? (
                                <span className="text-amber-600">(Build-Up)</span>
                              ) : null}
                            </label>
                            <select
                              value={section.edgeTypeId}
                              onChange={(e) =>
                                updateSection(area.key, section.key, { edgeTypeId: e.target.value })
                              }
                              className={compactInput}
                            >
                              <option value="">-</option>
                              {props.edgeTypes.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.name} (${Number(e.pricePerSqft).toFixed(2)}/sqft)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                              {sectionSqft.toFixed(2)} sqft
                            </span>
                            {area.sections.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSection(area.key, section.key)}
                                className="text-red-600 hover:underline print:hidden"
                                title="Remove table"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase text-gray-500 dark:text-gray-400">
                              <th className="w-1/3 py-1 pr-1">Length</th>
                              <th className="w-1/3 py-1 pr-1">Width</th>
                              <th className="py-1 pr-1">SqFt</th>
                              <th className="w-4 print:hidden" />
                            </tr>
                          </thead>
                          <tbody>
                            {section.rows.map((row) => {
                              const l = parseFraction(row.lengthIn);
                              const w = parseFraction(row.widthIn);
                              const sqft = l > 0 && w > 0 ? (l * w) / 144 : 0;
                              return (
                                <tr key={row.key}>
                                  <td className="py-0.5 pr-1">
                                    <input
                                      value={row.lengthIn}
                                      onChange={(e) =>
                                        updateRow(area.key, section.key, row.key, {
                                          lengthIn: e.target.value,
                                        })
                                      }
                                      className={compactInput}
                                      placeholder={"80 1/4"}
                                      inputMode="decimal"
                                    />
                                  </td>
                                  <td className="py-0.5 pr-1">
                                    <input
                                      value={row.widthIn}
                                      onChange={(e) =>
                                        updateRow(area.key, section.key, row.key, {
                                          widthIn: e.target.value,
                                        })
                                      }
                                      className={compactInput}
                                      inputMode="decimal"
                                    />
                                  </td>
                                  <td className="py-0.5 pr-1 text-gray-600 dark:text-gray-400">
                                    {sqft.toFixed(2)}
                                  </td>
                                  <td className="py-0.5 print:hidden">
                                    {section.rows.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeRow(area.key, section.key, row.key)}
                                        className="text-red-600 hover:underline"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <button
                          type="button"
                          onClick={() => addRow(area.key, section.key)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline print:hidden"
                        >
                          <Plus className="h-3 w-3" /> Add Row
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addSection(area.key)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 print:hidden"
                  >
                    <Table2 className="h-3.5 w-3.5" /> Add Table
                  </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      <button
        type="button"
        onClick={addArea}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 print:hidden"
      >
        <Plus className="h-4 w-4" /> Add Area
      </button>
    </div>
  );
}

function LineItemCompact({
  label,
  options,
  optionId,
  qty,
  onOptionChange,
  onQtyChange,
  total,
}: {
  label: string;
  options: Option[];
  optionId: string;
  qty: string;
  onOptionChange: (v: string) => void;
  onQtyChange: (v: string) => void;
  total: number;
}) {
  return (
    <div className="col-span-2 grid grid-cols-[1fr_48px_60px] items-end gap-1.5">
      <div>
        <label className={compactLabel}>{label}</label>
        <select value={optionId} onChange={(e) => onOptionChange(e.target.value)} className={compactInput}>
          <option value="">-</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <select value={qty} onChange={(e) => onQtyChange(e.target.value)} className={compactInput}>
        {QTY_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className="pb-1.5 text-right text-gray-500 dark:text-gray-400">{formatCurrency(total)}</span>
    </div>
  );
}

function LineItemFlatCompact({
  label,
  options,
  optionId,
  onOptionChange,
  total,
}: {
  label: string;
  options: Option[];
  optionId: string;
  onOptionChange: (v: string) => void;
  total: number;
}) {
  return (
    <div className="col-span-2 grid grid-cols-[1fr_60px] items-end gap-1.5">
      <div>
        <label className={compactLabel}>{label}</label>
        <select value={optionId} onChange={(e) => onOptionChange(e.target.value)} className={compactInput}>
          <option value="">-</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <span className="pb-1.5 text-right text-gray-500 dark:text-gray-400">{formatCurrency(total)}</span>
    </div>
  );
}
