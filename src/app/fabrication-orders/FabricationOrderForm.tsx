"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, AlertTriangle, Image as ImageIcon, PenLine } from "lucide-react";
import {
  computeAreaTotals,
  formatCurrency,
  type CalcAreaInput,
} from "@/lib/fabricationCalc";
import CanvasDrawing, { type CanvasShape } from "./CanvasDrawing";
import AreaImageUploader, {
  type ExistingImage,
  type PendingImage,
} from "./AreaImageUploader";

type Option = { id: string; name: string; [key: string]: unknown };

const STONE_THICKNESS_OPTIONS: { value: string; label: string }[] = [
  { value: "EIGHT_MM", label: "8mm" },
  { value: "TWELVE_MM", label: "12mm" },
  { value: "TWO_CM", label: "2cm" },
  { value: "THREE_CM", label: "3cm" },
  { value: "FIFTEEN_MM", label: "15mm" },
];

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
  sinkTypeText: string;
  faucetText: string;
  stoneName: string;
  stoneThickness: string;
  whNumber: string;
  backsplashIn: string;
  slabSupplierId: string;
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
  otherChargeOptionId: string;
  removalOptionId: string;
  leftoverNote: string;
  sections: SectionState[];
  drawingMode: "CANVAS" | "IMAGE";
  canvasShapes: CanvasShape[];
  existingImages: ExistingImage[];
  pendingImages: PendingImage[];
  removedImageIds: string[];
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
  return { key: nextKey(), edgeTypeId: "", rows: [emptyRow()] };
}

function emptyArea(name = ""): AreaState {
  return {
    key: nextKey(),
    name,
    sinkTypeText: "",
    faucetText: "",
    stoneName: "",
    stoneThickness: "",
    whNumber: "",
    backsplashIn: "",
    slabSupplierId: "",
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
    otherChargeOptionId: "",
    removalOptionId: "",
    leftoverNote: "",
    sections: [emptySection()],
    drawingMode: "CANVAS",
    canvasShapes: [],
    existingImages: [],
    pendingImages: [],
    removedImageIds: [],
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900";
const labelClass = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400";

export default function FabricationOrderForm(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editOrderId = searchParams.get("orderId");

  const [orderId, setOrderId] = useState<string | null>(editOrderId);
  const [clientName, setClientName] = useState("");
  const [salesRep, setSalesRep] = useState(props.currentUserName);
  const [notes, setNotes] = useState("");
  const [areas, setAreas] = useState<AreaState[]>([emptyArea("Area 1")]);

  const [loading, setLoading] = useState(Boolean(editOrderId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!editOrderId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/fabrication-orders/${editOrderId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load order");

        setClientName(json.clientName || "");
        setSalesRep(json.salesRep || "");
        setNotes(json.notes || "");
        setAreas(
          (json.areas || []).map((a: any) => ({
            key: nextKey(),
            id: a.id,
            name: a.name || "",
            sinkTypeText: a.sinkTypeText || "",
            faucetText: a.faucetText || "",
            stoneName: a.stoneName || "",
            stoneThickness: a.stoneThickness || "",
            whNumber: a.whNumber || "",
            backsplashIn: a.backsplashIn != null ? String(a.backsplashIn) : "",
            slabSupplierId: a.slabSupplierId || "",
            slabLengthIn: "",
            slabWidthIn: "",
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
            otherChargeOptionId: a.otherChargeOptionId || "",
            removalOptionId: a.removalOptionId || "",
            leftoverNote: a.leftoverNote || "",
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
            drawingMode: a.drawingMode === "IMAGE" ? "IMAGE" : "CANVAS",
            canvasShapes: Array.isArray(a.canvasData?.shapes) ? a.canvasData.shapes : [],
            existingImages: (a.images || []).map((img: any) => ({
              id: img.id,
              fileUrl: img.fileUrl,
              caption: img.caption,
            })),
            pendingImages: [],
            removedImageIds: [],
          })),
        );
      } catch (err: any) {
        setError(err?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [editOrderId]);

  function updateArea(key: string, patch: Partial<AreaState>) {
    setAreas((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  function addArea() {
    setAreas((prev) => [...prev, emptyArea(`Area ${prev.length + 1}`)]);
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
          rows: s.rows.map((r) => ({ lengthIn: num(r.lengthIn), widthIn: num(r.widthIn) })),
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
      otherChargePrice: area.otherChargeOptionId
        ? findPrice(props.otherCharges, area.otherChargeOptionId)
        : 0,
      removalPrice: area.removalOptionId
        ? findPrice(props.removals, area.removalOptionId)
        : 0,
      slabAmount: num(area.slabAmount),
      slabLengthIn: num(area.slabLengthIn),
      slabWidthIn: num(area.slabWidthIn),
      slabQty: num(area.slabQty),
    };
    return computeAreaTotals(calcInput);
  }

  const areaResults = areas.map((a) => calcForArea(a));
  const orderTotal = areaResults.reduce((sum, r) => sum + r.areaTotal, 0);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!clientName.trim()) throw new Error("Client name is required.");
      if (!salesRep.trim()) throw new Error("Sales rep is required.");
      if (areas.length === 0) throw new Error("Add at least one area.");

      const payload = {
        clientName: clientName.trim(),
        salesRep: salesRep.trim(),
        notes,
        areas: areas.map((a, idx) => ({
          id: a.id,
          name: a.name.trim() || `Area ${idx + 1}`,
          sortOrder: idx,
          sinkTypeText: a.sinkTypeText,
          faucetText: a.faucetText,
          stoneName: a.stoneName,
          stoneThickness: a.stoneThickness || null,
          whNumber: a.whNumber,
          backsplashIn: a.backsplashIn ? num(a.backsplashIn) : null,
          slabSupplierId: a.slabSupplierId || null,
          slabLengthIn: num(a.slabLengthIn),
          slabWidthIn: num(a.slabWidthIn),
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
          otherChargeOptionId: a.otherChargeOptionId || null,
          removalOptionId: a.removalOptionId || null,
          leftoverNote: a.leftoverNote,
          drawingMode: a.drawingMode,
          canvasData: { shapes: a.canvasShapes },
          sections: a.sections.map((s, sIdx) => ({
            edgeTypeId: s.edgeTypeId || null,
            sortOrder: sIdx,
            rows: s.rows.map((r, rIdx) => ({
              lengthIn: num(r.lengthIn),
              widthIn: num(r.widthIn),
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
        })),
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
    <div className="space-y-6 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {orderId ? "Edit Fabrication Order" : "New Fabrication Order"}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Draw or upload each area&apos;s layout, pick finishes, and the price calculates automatically.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Order Total</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(orderTotal)}
          </div>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 md:grid-cols-3">
        <div>
          <label className={labelClass}>Client Name</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={inputClass}
            placeholder="Last, First"
          />
        </div>
        <div>
          <label className={labelClass}>Sales Rep</label>
          <input
            value={salesRep}
            onChange={(e) => setSalesRep(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
      </div>

      {areas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No areas yet. Add one to start pricing this job.
        </div>
      ) : (
        areas.map((area, areaIdx) => {
          const result = areaResults[areaIdx];
          return (
            <div
              key={area.key}
              className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between gap-4">
                <input
                  value={area.name}
                  onChange={(e) => updateArea(area.key, { name: e.target.value })}
                  className="w-64 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-lg font-semibold dark:border-gray-600 dark:bg-gray-900"
                  placeholder="Area name (e.g. Master Bathroom)"
                />
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Area Total</div>
                    <div className="text-lg font-bold">{formatCurrency(result.areaTotal)}</div>
                  </div>
                  {areas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArea(area.key)}
                      className="rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      title="Remove area"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Header fields */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <label className={labelClass}>Sink Type</label>
                  <input
                    value={area.sinkTypeText}
                    onChange={(e) => updateArea(area.key, { sinkTypeText: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Faucet</label>
                  <input
                    value={area.faucetText}
                    onChange={(e) => updateArea(area.key, { faucetText: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stone</label>
                  <input
                    value={area.stoneName}
                    onChange={(e) => updateArea(area.key, { stoneName: e.target.value })}
                    className={inputClass}
                    list={`stone-list-${area.key}`}
                  />
                  <datalist id={`stone-list-${area.key}`}>
                    {props.stoneSuggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className={labelClass}>Thickness</label>
                  <select
                    value={area.stoneThickness}
                    onChange={(e) => updateArea(area.key, { stoneThickness: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">-</option>
                    {STONE_THICKNESS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>WH #</label>
                  <input
                    value={area.whNumber}
                    onChange={(e) => updateArea(area.key, { whNumber: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Backsplash (in)</label>
                  <input
                    type="number"
                    value={area.backsplashIn}
                    onChange={(e) => updateArea(area.key, { backsplashIn: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Slab */}
              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Slab</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  <div>
                    <label className={labelClass}>Supplier</label>
                    <select
                      value={area.slabSupplierId}
                      onChange={(e) => updateArea(area.key, { slabSupplierId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">-</option>
                      {props.slabSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Slab Length (in)</label>
                    <input
                      type="number"
                      value={area.slabLengthIn}
                      onChange={(e) => updateArea(area.key, { slabLengthIn: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Slab Width (in)</label>
                    <input
                      type="number"
                      value={area.slabWidthIn}
                      onChange={(e) => updateArea(area.key, { slabWidthIn: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select
                      value={area.slabTypeId}
                      onChange={(e) => updateArea(area.key, { slabTypeId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">-</option>
                      {props.slabTypes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Slab Qty (entered)</label>
                    <input
                      type="number"
                      value={area.slabQty}
                      onChange={(e) => updateArea(area.key, { slabQty: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Slab Amount ($ sold for)</label>
                    <input
                      type="number"
                      value={area.slabAmount}
                      onChange={(e) => updateArea(area.key, { slabAmount: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                {result.slabPieceSqft > 0 && (
                  <div
                    className={`mt-2 flex items-center gap-2 rounded-md p-2 text-sm ${
                      result.slabQtyFlagged
                        ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    }`}
                  >
                    {result.slabQtyFlagged && <AlertTriangle className="h-4 w-4 shrink-0" />}
                    Recommended slabs: <strong>{result.slabRecommendedQty}</strong> (job {(result.jobSqft + result.buildUpSqft).toFixed(2)} sqft incl. 15% waste, {result.slabPieceSqft.toFixed(2)} sqft/slab).
                    {result.slabQtyFlagged
                      ? " Entered quantity looks insufficient."
                      : " Entered quantity looks sufficient."}
                  </div>
                )}
              </div>

              {/* Sections / edge & build-up grids */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Countertop Pieces (Length x Width)
                  </h3>
                  <button
                    type="button"
                    onClick={() => addSection(area.key)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                  >
                    <Plus className="h-3 w-3" /> Add Section
                  </button>
                </div>
                {area.sections.map((section) => {
                  const edgeType = edgeTypeById.get(section.edgeTypeId);
                  const sectionSqft = section.rows.reduce((sum, r) => {
                    const l = num(r.lengthIn);
                    const w = num(r.widthIn);
                    return l > 0 && w > 0 ? sum + (l * w) / 144 : sum;
                  }, 0);
                  return (
                    <div
                      key={section.key}
                      className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                        <div className="w-64">
                          <label className={labelClass}>
                            Edge / Finish Type{" "}
                            {edgeType?.isBuildUp ? (
                              <span className="text-amber-600">(Build-Up)</span>
                            ) : null}
                          </label>
                          <select
                            value={section.edgeTypeId}
                            onChange={(e) =>
                              updateSection(area.key, section.key, { edgeTypeId: e.target.value })
                            }
                            className={inputClass}
                          >
                            <option value="">-</option>
                            {props.edgeTypes.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name} (${Number(e.pricePerSqft).toFixed(2)}/sqft{e.isBuildUp ? ", build-up" : ""})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {sectionSqft.toFixed(2)} sqft
                          </span>
                          {area.sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSection(area.key, section.key)}
                              className="text-red-600 hover:underline"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase text-gray-500 dark:text-gray-400">
                            <th className="py-1 pr-2">Length (in)</th>
                            <th className="py-1 pr-2">Width (in)</th>
                            <th className="py-1 pr-2">SqFt</th>
                            <th className="py-1 pr-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row) => {
                            const l = num(row.lengthIn);
                            const w = num(row.widthIn);
                            const sqft = l > 0 && w > 0 ? (l * w) / 144 : 0;
                            return (
                              <tr key={row.key}>
                                <td className="py-1 pr-2">
                                  <input
                                    type="number"
                                    value={row.lengthIn}
                                    onChange={(e) =>
                                      updateRow(area.key, section.key, row.key, {
                                        lengthIn: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </td>
                                <td className="py-1 pr-2">
                                  <input
                                    type="number"
                                    value={row.widthIn}
                                    onChange={(e) =>
                                      updateRow(area.key, section.key, row.key, {
                                        widthIn: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </td>
                                <td className="py-1 pr-2 text-gray-600 dark:text-gray-400">
                                  {sqft.toFixed(2)}
                                </td>
                                <td className="py-1 pr-2">
                                  {section.rows.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeRow(area.key, section.key, row.key)}
                                      className="text-red-600 hover:underline"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
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
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Plus className="h-3 w-3" /> Add row
                      </button>
                    </div>
                  );
                })}
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-4">
                  <div>Job SqFt: <strong>{result.jobSqft.toFixed(2)}</strong></div>
                  <div>Labor: <strong>{formatCurrency(result.labor)}</strong></div>
                  <div>Build-Up SqFt: <strong>{result.buildUpSqft.toFixed(2)}</strong></div>
                  <div>Build-Up: <strong>{formatCurrency(result.buildUp)}</strong></div>
                </div>
              </div>

              {/* Line items */}
              <div className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-2 lg:grid-cols-4">
                <LineItemQty
                  label="Sink Cutout"
                  options={props.sinkCutouts}
                  optionId={area.sinkCutoutOptionId}
                  qty={area.sinkCutoutQty}
                  onOptionChange={(v) => updateArea(area.key, { sinkCutoutOptionId: v })}
                  onQtyChange={(v) => updateArea(area.key, { sinkCutoutQty: v })}
                  total={result.sinkCutoutTotal}
                />
                <LineItemQty
                  label="Cooktop Cutout"
                  options={props.cooktops}
                  optionId={area.cooktopOptionId}
                  qty={area.cooktopQty}
                  onOptionChange={(v) => updateArea(area.key, { cooktopOptionId: v })}
                  onQtyChange={(v) => updateArea(area.key, { cooktopQty: v })}
                  total={result.cooktopTotal}
                />
                <LineItemQty
                  label="Bump Out"
                  options={props.bumpOuts}
                  optionId={area.bumpOutOptionId}
                  qty={area.bumpOutQty}
                  onOptionChange={(v) => updateArea(area.key, { bumpOutOptionId: v })}
                  onQtyChange={(v) => updateArea(area.key, { bumpOutQty: v })}
                  total={result.bumpOutTotal}
                />
                <LineItemQty
                  label="Cutting Board"
                  options={props.cuttingBoards}
                  optionId={area.cuttingBoardOptionId}
                  qty={area.cuttingBoardQty}
                  onOptionChange={(v) => updateArea(area.key, { cuttingBoardOptionId: v })}
                  onQtyChange={(v) => updateArea(area.key, { cuttingBoardQty: v })}
                  total={result.cuttingBoardTotal}
                />
                <LineItemFlat
                  label="Windowsill"
                  options={props.windowsills}
                  optionId={area.windowsillOptionId}
                  onOptionChange={(v) => updateArea(area.key, { windowsillOptionId: v })}
                  total={result.windowsillTotal}
                />
                <LineItemFlat
                  label="Power Station"
                  options={props.powerStations}
                  optionId={area.powerStationOptionId}
                  onOptionChange={(v) => updateArea(area.key, { powerStationOptionId: v })}
                  total={result.powerStationTotal}
                />
                <LineItemFlat
                  label="Others"
                  options={props.otherCharges}
                  optionId={area.otherChargeOptionId}
                  onOptionChange={(v) => updateArea(area.key, { otherChargeOptionId: v })}
                  total={result.otherChargeTotal}
                />
                <LineItemFlat
                  label="Removal"
                  options={props.removals}
                  optionId={area.removalOptionId}
                  onOptionChange={(v) => updateArea(area.key, { removalOptionId: v })}
                  total={result.removalTotal}
                />
              </div>

              <div>
                <label className={labelClass}>Leftover (notes only, no $ effect)</label>
                <input
                  value={area.leftoverNote}
                  onChange={(e) => updateArea(area.key, { leftoverNote: e.target.value })}
                  className={inputClass}
                />
              </div>

              {/* Drawing */}
              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Layout</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateArea(area.key, { drawingMode: "CANVAS" })}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                        area.drawingMode === "CANVAS"
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 text-gray-600 dark:border-gray-600"
                      }`}
                    >
                      <PenLine className="h-3 w-3" /> Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => updateArea(area.key, { drawingMode: "IMAGE" })}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                        area.drawingMode === "IMAGE"
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 text-gray-600 dark:border-gray-600"
                      }`}
                    >
                      <ImageIcon className="h-3 w-3" /> Upload Image
                    </button>
                  </div>
                </div>
                {area.drawingMode === "CANVAS" ? (
                  <CanvasDrawing
                    value={area.canvasShapes}
                    onChange={(shapes) => updateArea(area.key, { canvasShapes: shapes })}
                  />
                ) : (
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
                )}
              </div>
            </div>
          );
        })
      )}

      <button
        type="button"
        onClick={addArea}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400"
      >
        <Plus className="h-4 w-4" /> Add Area
      </button>

      <div className="sticky bottom-0 flex items-center justify-between rounded-lg border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        <div>
          <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Order Total</div>
          <div className="text-2xl font-bold">{formatCurrency(orderTotal)}</div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : orderId ? "Save Changes" : "Save Fabrication Order"}
        </button>
      </div>
    </div>
  );
}

function LineItemQty({
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
    <div>
      <label className={labelClass}>{label}</label>
      <select value={optionId} onChange={(e) => onOptionChange(e.target.value)} className={inputClass}>
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} (${Number(o.price ?? 0).toFixed(2)})
          </option>
        ))}
      </select>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={qty}
          onChange={(e) => onQtyChange(e.target.value)}
          className={inputClass}
          placeholder="Qty"
        />
        <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function LineItemFlat({
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
    <div>
      <label className={labelClass}>{label}</label>
      <select value={optionId} onChange={(e) => onOptionChange(e.target.value)} className={inputClass}>
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} (${Number(o.price ?? 0).toFixed(2)})
          </option>
        ))}
      </select>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatCurrency(total)}</div>
    </div>
  );
}
