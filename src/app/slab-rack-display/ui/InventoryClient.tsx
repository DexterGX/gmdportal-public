"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SlabBayState } from "./mockData";
import {
  encodeClientName,
  fetchStateFromDb,
  loadState,
  saveStateToDb,
  splitClientName,
  updateSlab,
} from "./storage";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type InventorySortKey =
  | "id"
  | "scannerId"
  | "name"
  | "brand"
  | "finish"
  | "thickness"
  | "size"
  | "batch"
  | "type"
  | "client"
  | "jobId"
  | "notes"
  | "rack"
  | "createdAt";

type SortDirection = "asc" | "desc";

const SLAB_VIEW_LICENSE = "532b5c05af7b036ff8a0200d0c8dc6da";
const buildSlabViewUrl = (scannerId: string) =>
  `https://fusiondrivecloud.com/slabview/?license=${SLAB_VIEW_LICENSE}&SlabID=${encodeURIComponent(
    scannerId,
  )}`;

const baseBrandOptions = [
  "CAMBRIA",
  "CEASARSTONE - Porcelain",
  "CEASARSTONE - Quartz",
  "COMPAC",
  "COSENTINO - Dekton Porcelain",
  "COSENTINO - Silestone Quartz",
  "COVERLAM(HRA) - Porcelain",
  "DALTILE - Panoramic Porcelain",
  "DALTILE - Quartz",
  "KIVA",
  "LX HAUSYS",
  "MSI - Quartz",
  "NEOLITH",
  "OPUSTONE - Relativa Porcelain",
  "OPUSTONE - Santamargherita Quartz",
  "PENTAL - Quartz",
  "SPECTRUM - Quartz",
  "STONE MALL",
  "TSFC",
  "UMI - Infinity Porcelain",
  "UMI - Pompeii Quartz",
  "UMI - Vetrazzo",
  "WILLSONART",
];

const baseThicknessOptions = ["6mm", "8mm", "10mm", "12mm", "2cm", "3cm"];

const baseFinishOptions = [
  "CONCRETE",
  "DUAL",
  "HONED",
  "LEATHER",
  "MATTE",
  "NATURAL",
  "OTHER",
  "POLISHED",
  "ROUGH",
  "STONE",
  "ULTRA_ROUGH",
  "SATIN",
  "SATIN_HONED",
  "PATINATO",
  "LEVIGATO_PEARL",
  "GLAM",
  "GINZA",
  "HOLOS",
  "TWILL",
  "JUTA",
  "DENIM",
  "DAMIER",
  "LAVA",
  "SILK",
  "LUXE",
  "BRUSHED",
  "TEXTURED",
  "SMOOTH_MATTE",
  "TEXTURED_MATTE",
  "VELVET",
  "TEXTURED_VELVET",
  "SATIN_RIDGE",
  "SUEDE",
  "DECOR_POLISHED",
  "NANOTECH_POLISHED",
  "NATURAL_TOUCH",
  "RIVERWASHED",
  "SLATE",
  "ULTRASOFT",
];

const formatFinishOption = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function InventoryClient({ userName }: { userName: string }) {
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [slabSearchTerm, setSlabSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [scannerIdSearchTerm, setScannerIdSearchTerm] = useState("");
  const [notesSearchTerm, setNotesSearchTerm] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedRacks, setSelectedRacks] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedThicknesses, setSelectedThicknesses] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<InventorySortKey>("rack");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editingSlabId, setEditingSlabId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editScannerId, setEditScannerId] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editFinish, setEditFinish] = useState("");
  const [editThickness, setEditThickness] = useState("");
  const [editSizeH, setEditSizeH] = useState("");
  const [editSizeW, setEditSizeW] = useState("");
  const [editType, setEditType] = useState<
    "SLAB" | "GMD" | "REMNANT" | "RESERVED" | "CLIENT_SLAB"
  >("SLAB");
  const [editBatchIndex, setEditBatchIndex] = useState("");
  const [editBatchSize, setEditBatchSize] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editOriginalClientName, setEditOriginalClientName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editJobId, setEditJobId] = useState("");
  const [editRackId, setEditRackId] = useState("");
  const [editClientSearchTerm, setEditClientSearchTerm] = useState("");
  const [editOriginalClientSearchTerm, setEditOriginalClientSearchTerm] =
    useState("");
  const [editClientSuggestions, setEditClientSuggestions] = useState<string[]>(
    [],
  );
  const [editOriginalClientSuggestions, setEditOriginalClientSuggestions] =
    useState<string[]>([]);
  const [showEditClientDropdown, setShowEditClientDropdown] = useState(false);
  const [showEditOriginalClientDropdown, setShowEditOriginalClientDropdown] =
    useState(false);
  const [loadingEditClients, setLoadingEditClients] = useState(false);
  const [loadingEditOriginalClients, setLoadingEditOriginalClients] =
    useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editClientDropdownRef = useRef<HTMLDivElement | null>(null);
  const editOriginalClientDropdownRef = useRef<HTMLDivElement | null>(null);

  const parseSize = (value: string) => {
    const [h = "", w = ""] = value.split("x").map((part) => part.trim());
    return { h, w };
  };

  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const datePart = date.toLocaleDateString();
    const timePart = date.toLocaleTimeString();
    return { datePart, timePart };
  };

  const racks = useMemo(
    () =>
      state.racks
        .map((rack) => rack.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [state.racks],
  );

  const types = useMemo(
    () =>
      Array.from(new Set(state.slabs.map((slab) => slab.type))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [state.slabs],
  );

  const thicknesses = useMemo(
    () =>
      Array.from(new Set(state.slabs.map((slab) => slab.thickness))).sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      ),
    [state.slabs],
  );

  const brandOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...baseBrandOptions,
          ...state.slabs.map((slab) => slab.brand).filter(Boolean),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [state.slabs],
  );

  const thicknessOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...baseThicknessOptions,
          ...state.slabs.map((slab) => slab.thickness),
        ]),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [state.slabs],
  );

  const finishOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...baseFinishOptions,
          ...state.slabs.map((slab) => slab.finish || "").filter(Boolean),
        ]),
      ).sort((a, b) =>
        formatFinishOption(a).localeCompare(formatFinishOption(b)),
      ),
    [state.slabs],
  );

  const compareValues = (
    left: string | number,
    right: string | number,
    direction: SortDirection,
    numeric = false,
  ) => {
    const result = numeric
      ? Number(left) - Number(right)
      : String(left).localeCompare(String(right), undefined, {
          numeric: true,
          sensitivity: "base",
        });
    return direction === "asc" ? result : -result;
  };

  const handleSort = (key: InventorySortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const renderSortLabel = (key: InventorySortKey, label: string) => {
    const indicator =
      sortKey === key ? (sortDirection === "asc" ? " ▲" : " ▼") : "";
    return `${label}${indicator}`;
  };

  const rows = useMemo(() => {
    const slabTerm = slabSearchTerm.trim().toLowerCase();
    const clientTerm = clientSearchTerm.trim().toLowerCase();
    const scannerIdTerm = scannerIdSearchTerm.trim().toLowerCase();
    const notesTerm = notesSearchTerm.trim().toLowerCase();
    const rackIds = selectedRacks.map((rack) => rack.toLowerCase());
    return state.slabs
      .filter((slab) => {
        const { clientName, originalClientName } = splitClientName(
          slab.clientName,
        );
        const matchesRack =
          rackIds.length === 0 ? true : rackIds.includes(slab.rackId);
        const matchesBrand =
          selectedBrands.length === 0
            ? true
            : selectedBrands.includes(slab.brand || "");
        const matchesType =
          selectedTypes.length === 0 ? true : selectedTypes.includes(slab.type);
        const matchesThickness =
          selectedThicknesses.length === 0
            ? true
            : selectedThicknesses.includes(slab.thickness);
        const matchesSlab = slabTerm
          ? slab.name.toLowerCase().includes(slabTerm) ||
            (slab.brand || "").toLowerCase().includes(slabTerm) ||
            (slab.finish || "").toLowerCase().includes(slabTerm) ||
            (slab.jobId || "").toLowerCase().includes(slabTerm) ||
            (slab.scannerId || "").toLowerCase().includes(slabTerm) ||
            slab.id.toLowerCase().includes(slabTerm)
          : true;
        const matchesClient = clientTerm
          ? clientName.toLowerCase().includes(clientTerm) ||
            (originalClientName || "").toLowerCase().includes(clientTerm)
          : true;
        const matchesUser = scannerIdTerm
          ? (slab.scannerId || "").toLowerCase().includes(scannerIdTerm)
          : true;
        const matchesNotes = notesTerm
          ? (slab.notes || "").toLowerCase().includes(notesTerm)
          : true;
        return (
          matchesRack &&
          matchesBrand &&
          matchesType &&
          matchesThickness &&
          matchesSlab &&
          matchesClient &&
          matchesUser &&
          matchesNotes
        );
      })
      .sort((a, b) => {
        const aClient = splitClientName(a.clientName).clientName;
        const bClient = splitClientName(b.clientName).clientName;
        const aBatch =
          a.batchIndex && a.batchSize ? `${a.batchIndex}/${a.batchSize}` : "";
        const bBatch =
          b.batchIndex && b.batchSize ? `${b.batchIndex}/${b.batchSize}` : "";

        switch (sortKey) {
          case "id":
            return compareValues(a.id, b.id, sortDirection);
          case "scannerId":
            return compareValues(
              a.scannerId || "",
              b.scannerId || "",
              sortDirection,
            );
          case "name":
            return compareValues(a.name, b.name, sortDirection);
          case "brand":
            return compareValues(a.brand || "", b.brand || "", sortDirection);
          case "finish":
            return compareValues(a.finish || "", b.finish || "", sortDirection);
          case "thickness":
            return compareValues(a.thickness, b.thickness, sortDirection);
          case "size":
            return compareValues(a.size, b.size, sortDirection);
          case "batch":
            return compareValues(aBatch, bBatch, sortDirection);
          case "type":
            return compareValues(a.type, b.type, sortDirection);
          case "client":
            return compareValues(aClient, bClient, sortDirection);
          case "jobId":
            return compareValues(a.jobId || "", b.jobId || "", sortDirection);
          case "notes":
            return compareValues(a.notes || "", b.notes || "", sortDirection);
          case "rack":
            return compareValues(a.rackId, b.rackId, sortDirection);
          case "createdAt": {
            const aTime = new Date(a.createdAt).getTime();
            const bTime = new Date(b.createdAt).getTime();
            if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
              return compareValues(aTime, bTime, sortDirection, true);
            }
            return compareValues(a.createdAt, b.createdAt, sortDirection);
          }
          default:
            return 0;
        }
      });
  }, [
    state.slabs,
    selectedRacks,
    selectedTypes,
    selectedThicknesses,
    slabSearchTerm,
    clientSearchTerm,
    scannerIdSearchTerm,
    notesSearchTerm,
    selectedBrands,
    sortDirection,
    sortKey,
  ]);

  const renderClientCell = (slab: (typeof rows)[number]) => {
    const { clientName, originalClientName } = splitClientName(slab.clientName);
    return (
      <div className="space-y-1">
        <div>{clientName || "-"}</div>
        {slab.type === "GMD" && originalClientName ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Original Client: {originalClientName}
          </div>
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    let active = true;
    const load = () => {
      if (isSavingEdit) {
        return;
      }
      if (!hasLoaded) {
        setIsLoading(true);
      }
      fetchStateFromDb()
        .then((data) => {
          if (!active || !data) return;
          setState(data);
        })
        .finally(() => {
          if (!active) return;
          setHasLoaded(true);
          setIsLoading(false);
        });
    };

    load();
    const intervalId = window.setInterval(load, 10000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasLoaded, isSavingEdit]);

  useEffect(() => {
    if (!editClientSearchTerm.trim()) {
      setEditClientSuggestions([]);
      setLoadingEditClients(false);
      return;
    }
    const controller = new AbortController();
    setLoadingEditClients(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/clients?q=${encodeURIComponent(editClientSearchTerm)}`,
        { signal: controller.signal },
      )
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setEditClientSuggestions(data))
        .catch(() => undefined)
        .finally(() => setLoadingEditClients(false));
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [editClientSearchTerm]);

  useEffect(() => {
    if (!editOriginalClientSearchTerm.trim()) {
      setEditOriginalClientSuggestions([]);
      setLoadingEditOriginalClients(false);
      return;
    }
    const controller = new AbortController();
    setLoadingEditOriginalClients(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/clients?q=${encodeURIComponent(editOriginalClientSearchTerm)}`,
        { signal: controller.signal },
      )
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setEditOriginalClientSuggestions(data))
        .catch(() => undefined)
        .finally(() => setLoadingEditOriginalClients(false));
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [editOriginalClientSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        editClientDropdownRef.current &&
        !editClientDropdownRef.current.contains(target)
      ) {
        setShowEditClientDropdown(false);
      }
      if (
        editOriginalClientDropdownRef.current &&
        !editOriginalClientDropdownRef.current.contains(target)
      ) {
        setShowEditOriginalClientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrint = () => {
    setTimeout(() => window.print(), 50);
  };

  const handleClearFilters = () => {
    setSlabSearchTerm("");
    setClientSearchTerm("");
    setScannerIdSearchTerm("");
    setNotesSearchTerm("");
    setSelectedBrands([]);
    setSelectedRacks([]);
    setSelectedTypes([]);
    setSelectedThicknesses([]);
  };

  const openEditModal = (slabId: string) => {
    const slab = state.slabs.find((item) => item.id === slabId);
    if (!slab) return;
    const { clientName, originalClientName } = splitClientName(slab.clientName);
    const { h, w } = parseSize(slab.size);
    setEditingSlabId(slab.id);
    setEditName(slab.name);
    setEditScannerId(slab.scannerId);
    setEditBrand(slab.brand || "");
    setEditFinish(slab.finish || "");
    setEditThickness(slab.thickness);
    setEditSizeH(h);
    setEditSizeW(w);
    setEditType(slab.type);
    setEditBatchIndex(slab.batchIndex ? String(slab.batchIndex) : "");
    setEditBatchSize(slab.batchSize ? String(slab.batchSize) : "");
    setEditClientName(clientName);
    setEditOriginalClientName(originalClientName || "");
    setEditNotes(slab.notes || "");
    setEditJobId(slab.jobId || "");
    setEditRackId(slab.rackId);
    setEditClientSearchTerm(clientName);
    setEditOriginalClientSearchTerm(originalClientName || "");
    setEditClientSuggestions([]);
    setEditOriginalClientSuggestions([]);
    setShowEditClientDropdown(false);
    setShowEditOriginalClientDropdown(false);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingSlabId(null);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSlabId) return;
    if (!editName.trim()) {
      setEditError("Slab name is required.");
      return;
    }
    if (!editScannerId.trim()) {
      setEditError("Scanner ID is required.");
      return;
    }
    if (!editBrand.trim()) {
      setEditError("Brand is required.");
      return;
    }
    if (!editThickness.trim()) {
      setEditError("Thickness is required.");
      return;
    }
    if (!editSizeH.trim() || !editSizeW.trim()) {
      setEditError("Size H and Size W are required.");
      return;
    }
    if (!editType.trim()) {
      setEditError("Type is required.");
      return;
    }
    if (!editClientName.trim()) {
      setEditError("Client is required.");
      return;
    }
    if (editType === "GMD" && !editOriginalClientName.trim()) {
      setEditError("Original client is required for GMD slabs.");
      return;
    }
    setEditError(null);
    const size = [editSizeH.trim(), editSizeW.trim()]
      .filter(Boolean)
      .join(" x ");
    const batchIndexNum = Number(editBatchIndex);
    const batchSizeNum = Number(editBatchSize);

    const next = updateSlab(
      state,
      editingSlabId,
      {
        name: editName.trim(),
        scannerId: editScannerId.trim(),
        brand: editBrand,
        finish: editFinish,
        thickness: editThickness.trim(),
        size,
        type: editType,
        batchIndex:
          Number.isFinite(batchIndexNum) && batchIndexNum > 0
            ? batchIndexNum
            : undefined,
        batchSize:
          Number.isFinite(batchSizeNum) && batchSizeNum > 0
            ? batchSizeNum
            : undefined,
        clientName: encodeClientName(
          editClientName.trim(),
          editType === "GMD" ? editOriginalClientName.trim() : undefined,
        ),
        notes: editNotes,
        jobId: editJobId,
        rackId: editRackId,
      },
      userName,
    );

    try {
      setIsSavingEdit(true);
      await saveStateToDb(next);
      setState(next);
      closeEditModal();
    } catch {
      setEditError(
        "Unable to save this slab edit right now. Please try again.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Slab Inventory
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Full list of slabs in the gallery with scanner IDs and rack locations.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:hidden">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <input
            value={slabSearchTerm}
            onChange={(event) => setSlabSearchTerm(event.target.value)}
            placeholder="Filter by slab"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={clientSearchTerm}
            onChange={(event) => setClientSearchTerm(event.target.value)}
            placeholder="Filter by client"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={scannerIdSearchTerm}
            onChange={(event) => setScannerIdSearchTerm(event.target.value)}
            placeholder="Filter by scanner ID"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={notesSearchTerm}
            onChange={(event) => setNotesSearchTerm(event.target.value)}
            placeholder="Filter by notes"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <FilterMultiSelect
            label="Brand"
            options={brandOptions}
            selected={selectedBrands}
            onChange={setSelectedBrands}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Racks"
            options={racks}
            selected={selectedRacks}
            onChange={setSelectedRacks}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Type"
            options={types}
            selected={selectedTypes}
            onChange={setSelectedTypes}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Thickness"
            options={thicknesses}
            selected={selectedThicknesses}
            onChange={setSelectedThicknesses}
            fullWidth
            matchInputStyle
          />
        </div>
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Showing {rows.length} of {state.slabs.length}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Print inventory
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div
        id="print-area"
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:shadow-none print:bg-white"
      >
        <div className="hidden print:block mb-3">
          <h1 className="text-2xl font-semibold text-gray-800">
            Slab Inventory
          </h1>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading inventory...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm print-inventory-table">
              <thead>
                <tr className="hidden print:table-row print-spacer-row">
                  <th colSpan={15} aria-hidden="true" />
                </tr>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("id")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("id", "Slab ID")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("scannerId")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("scannerId", "Scanner ID")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("name", "Name")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("brand")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("brand", "Brand")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("finish")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("finish", "Finish")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("thickness")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("thickness", "Thickness")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("size")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("size", "Size")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("batch")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("batch", "Batch")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("type")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("type", "Type")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("client")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("client", "Client")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("jobId")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("jobId", "Job ID")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("notes")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("notes", "Notes")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("rack")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("rack", "Rack")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("createdAt")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("createdAt", "Date Added")}
                    </button>
                  </th>
                  <th className="py-2 pr-4 print:hidden">Edit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((slab) => (
                  <tr
                    key={slab.id}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.id}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {slab.scannerId ? (
                        <a
                          href={buildSlabViewUrl(slab.scannerId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {slab.scannerId}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.name}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.brand || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.finish || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.thickness}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.size}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.batchIndex && slab.batchSize
                        ? `${slab.batchIndex}/${slab.batchSize}`
                        : "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.type}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {renderClientCell(slab)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.jobId || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.notes || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.rackId.toUpperCase()}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {(() => {
                        const formatted = formatTimestamp(slab.createdAt);
                        if (typeof formatted === "string") return formatted;
                        return (
                          <div>
                            <div>{formatted.datePart}</div>
                            <div>{formatted.timePart}</div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 pr-4 print:hidden">
                      <button
                        type="button"
                        onClick={() => openEditModal(slab.id)}
                        className="inline-flex items-center rounded-lg border border-blue-500 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={15}
                      className="py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No slabs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingSlabId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Edit slab details
              </h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 pl-2 mb-1">
                  Slab details
                </div>
                {editError ? (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {editError}
                  </div>
                ) : null}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Slab name
                    </label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Scanner ID
                    </label>
                    <input
                      value={editScannerId}
                      onChange={(e) => setEditScannerId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Brand
                    </label>
                    <select
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="">Select brand</option>
                      {brandOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Finish
                    </label>
                    <select
                      value={editFinish}
                      onChange={(e) => setEditFinish(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="">Select finish</option>
                      {finishOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatFinishOption(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Thickness
                    </label>
                    <select
                      value={editThickness}
                      onChange={(e) => setEditThickness(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="">Select thickness</option>
                      {thicknessOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Size (H)
                    </label>
                    <input
                      value={editSizeH}
                      onChange={(e) => setEditSizeH(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Size (W)
                    </label>
                    <input
                      value={editSizeW}
                      onChange={(e) => setEditSizeW(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Batch index
                    </label>
                    <input
                      value={editBatchIndex}
                      onChange={(e) => setEditBatchIndex(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Batch size
                    </label>
                    <input
                      value={editBatchSize}
                      onChange={(e) => setEditBatchSize(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Type
                    </label>
                    <select
                      value={editType}
                      onChange={(e) =>
                        setEditType(
                          e.target.value as
                            | "SLAB"
                            | "GMD"
                            | "REMNANT"
                            | "RESERVED"
                            | "CLIENT_SLAB",
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="SLAB">SLAB</option>
                      <option value="GMD">GMD</option>
                      <option value="REMNANT">REMNANT</option>
                      <option value="RESERVED">RESERVED</option>
                      <option value="CLIENT_SLAB">CLIENT_SLAB</option>
                    </select>
                  </div>
                  <div ref={editClientDropdownRef} className="relative">
                    <label className="text-xs font-medium text-gray-500">
                      New client
                    </label>
                    <input
                      value={editClientName}
                      onFocus={() => setShowEditClientDropdown(true)}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditClientName(value);
                        setEditClientSearchTerm(value);
                        setShowEditClientDropdown(true);
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                    {showEditClientDropdown && (
                      <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
                        {loadingEditClients ? (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : editClientSuggestions.length > 0 ? (
                          editClientSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setEditClientName(suggestion);
                                setEditClientSearchTerm(suggestion);
                                setShowEditClientDropdown(false);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              {suggestion}
                            </button>
                          ))
                        ) : editClientSearchTerm.trim() ? (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No matches found
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {editType === "GMD" ? (
                    <div
                      ref={editOriginalClientDropdownRef}
                      className="relative"
                    >
                      <label className="text-xs font-medium text-gray-500">
                        Original client
                      </label>
                      <input
                        value={editOriginalClientName}
                        onFocus={() => setShowEditOriginalClientDropdown(true)}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEditOriginalClientName(value);
                          setEditOriginalClientSearchTerm(value);
                          setShowEditOriginalClientDropdown(true);
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                      {showEditOriginalClientDropdown && (
                        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
                          {loadingEditOriginalClients ? (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              Loading...
                            </div>
                          ) : editOriginalClientSuggestions.length > 0 ? (
                            editOriginalClientSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => {
                                  setEditOriginalClientName(suggestion);
                                  setEditOriginalClientSearchTerm(suggestion);
                                  setShowEditOriginalClientDropdown(false);
                                }}
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                {suggestion}
                              </button>
                            ))
                          ) : editOriginalClientSearchTerm.trim() ? (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              No matches found
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Job ID
                    </label>
                    <input
                      value={editJobId}
                      onChange={(e) => setEditJobId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-500">
                      Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 pl-2 mb-1">
                  Placement
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Rack
                    </label>
                    <select
                      value={editRackId}
                      onChange={(e) => setEditRackId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      {state.racks.map((rack) => (
                        <option key={rack.id} value={rack.id}>
                          {rack.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSavingEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
