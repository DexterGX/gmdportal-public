"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Slab, SlabBayState } from "./mockData";
import {
  addMultipleSlabs,
  encodeClientName,
  exitSlab,
  getRackById,
  getRackLoad,
  getRecommendedDistribution,
  getRecommendedRack,
  getSlabsByRack,
  moveSlab,
  splitClientName,
} from "./storage";

type ActionType = "add" | "move" | "exit" | null;

export default function SlabActions({
  state,
  onUpdate,
  defaultRackId,
  userName,
}: {
  state: SlabBayState;
  onUpdate: (next: SlabBayState) => void;
  defaultRackId?: string;
  userName: string;
}) {
  const [action, setAction] = useState<ActionType>(null);
  const [selectedRackId, setSelectedRackId] = useState(
    defaultRackId ?? state.racks[0]?.id,
  );
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientName, setClientName] = useState("");
  const [originalClientName, setOriginalClientName] = useState("");
  const [originalClientSearchTerm, setOriginalClientSearchTerm] = useState("");
  const [showOriginalClientDropdown, setShowOriginalClientDropdown] =
    useState(false);
  const [loadingOriginalClients, setLoadingOriginalClients] = useState(false);
  const [originalClientSuggestions, setOriginalClientSuggestions] = useState<
    string[]
  >([]);
  const [scannerId, setScannerId] = useState("");
  const [scannerIds, setScannerIds] = useState<string[]>([]);
  const [slabName, setSlabName] = useState("");
  const [brand, setBrand] = useState("");
  const [brandOther, setBrandOther] = useState("");
  const [thickness, setThickness] = useState("");
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [brandSearchTerm, setBrandSearchTerm] = useState("");
  const [finishPickerOpen, setFinishPickerOpen] = useState(false);
  const [finishSearchTerm, setFinishSearchTerm] = useState("");
  const [finishOther, setFinishOther] = useState("");
  const [thicknessPickerOpen, setThicknessPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [showSizeHDropdown, setShowSizeHDropdown] = useState(false);
  const [showSizeWDropdown, setShowSizeWDropdown] = useState(false);
  const [sizeHeight, setSizeHeight] = useState("");
  const [sizeWidth, setSizeWidth] = useState("");
  const [quantity, setQuantity] = useState<string>("1");
  const [slabType, setSlabType] = useState<
    "SLAB" | "GMD" | "REMNANT" | "RESERVED" | "CLIENT_SLAB"
  >("SLAB");
  const [finish, setFinish] = useState("");
  const [notes, setNotes] = useState("");
  const [scannerNotes, setScannerNotes] = useState<string[]>([]);
  const [jobId, setJobId] = useState("");
  const [selectedSlabId, setSelectedSlabId] = useState<string>("");
  const [fromRackId, setFromRackId] = useState<string>("");
  const [moveRackId, setMoveRackId] = useState<string>("");
  const [exitNote, setExitNote] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [slabSuggestions, setSlabSuggestions] = useState<string[]>([]);
  const [slabSearchTerm, setSlabSearchTerm] = useState("");
  const [showSlabDropdown, setShowSlabDropdown] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmPlan, setConfirmPlan] = useState<
    Array<{ rackId: string; count: number }>
  >([]);
  const [confirmRemaining, setConfirmRemaining] = useState(0);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: "success" | "error" | "warning";
      message: string;
    }>
  >([]);
  const [pendingAdd, setPendingAdd] = useState<{
    input: Omit<Slab, "id" | "createdAt" | "rackId">;
    scannerIds?: string[];
    slabNotes?: string[];
    quantity: number;
    preferredRackId?: string;
    printLabels?: boolean;
  } | null>(null);
  const [printSelectionOpen, setPrintSelectionOpen] = useState(false);
  const [printSelectionSlabs, setPrintSelectionSlabs] = useState<
    Array<{ id: string; scannerId: string; name: string }>
  >([]);
  const sizeOptions = useMemo(
    () => Array.from({ length: 201 }, (_, i) => String(i)),
    [],
  );
  const thicknessOptions = useMemo(
    () => ["6mm", "8mm", "10mm", "12mm", "2cm", "3cm"],
    [],
  );
  const typeOptions = useMemo(
    () => ["SLAB", "GMD", "REMNANT", "RESERVED", "CLIENT_SLAB"],
    [],
  );
  const OTHER_OPTION = "OTHER";
  const brandOptions = useMemo(
    () => [
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
      OTHER_OPTION,
    ],
    [OTHER_OPTION],
  );
  const finishOptions = useMemo(
    () => [
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
    ],
    [],
  );
  const formatFinishOption = (value: string) =>
    value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const filteredBrandOptions = useMemo(() => {
    const term = brandSearchTerm.trim().toLowerCase();
    if (!term) return brandOptions;
    return brandOptions.filter((option) => option.toLowerCase().includes(term));
  }, [brandOptions, brandSearchTerm]);
  const filteredFinishOptions = useMemo(() => {
    const term = finishSearchTerm.trim().toLowerCase();
    if (!term) return finishOptions;
    return finishOptions.filter((option) =>
      formatFinishOption(option).toLowerCase().includes(term),
    );
  }, [finishOptions, finishSearchTerm]);
  const brandDisplayValue =
    brand === OTHER_OPTION
      ? brandOther.trim()
        ? `Other - ${brandOther.trim()}`
        : "Other"
      : brand;
  const finishDisplayValue =
    finish === OTHER_OPTION
      ? finishOther.trim()
        ? `Other - ${finishOther.trim()}`
        : "Other"
      : finish;
  const capitalizeInput = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, " ")
      .replace(
        /(^|[\s-])([a-z])/g,
        (_, prefix: string, letter: string) =>
          `${prefix}${letter.toUpperCase()}`,
      );
  const clientDropdownRef = useRef<HTMLDivElement | null>(null);
  const originalClientDropdownRef = useRef<HTMLDivElement | null>(null);
  const slabDropdownRef = useRef<HTMLDivElement | null>(null);

  const racks = state.racks;
  const sortedRacks = useMemo(
    () =>
      [...racks].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      ),
    [racks],
  );

  const slabsByRack = useMemo(
    () =>
      racks.reduce<Record<string, Slab[]>>((acc, rack) => {
        acc[rack.id] = getSlabsByRack(state, rack.id);
        return acc;
      }, {}),
    [state, racks],
  );

  const selectedRack = selectedRackId
    ? getRackById(state, selectedRackId)
    : undefined;

  const recommendedRack = useMemo(
    () => getRecommendedRack(state, clientName || undefined),
    [state, clientName],
  );

  const distribution = useMemo(() => {
    const qty = Number(quantity);
    if (!selectedRackId || !Number.isFinite(qty) || qty <= 0) return null;
    return getRecommendedDistribution(
      state,
      qty,
      clientName || undefined,
      selectedRackId,
    );
  }, [state, quantity, clientName, selectedRackId]);

  useEffect(() => {
    if (action !== "add") return;
    if (defaultRackId) return;
    if (!recommendedRack) return;
    setSelectedRackId(recommendedRack.id);
  }, [action, defaultRackId, recommendedRack]);

  useEffect(() => {
    if (!fromRackId) return;
    setSelectedSlabId("");
  }, [fromRackId]);

  useEffect(() => {
    if (!clientSearchTerm) {
      setClientSuggestions([]);
      setLoadingClients(false);
      return;
    }
    const controller = new AbortController();
    setLoadingClients(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/clients?q=${encodeURIComponent(clientSearchTerm)}`,
        {
          signal: controller.signal,
        },
      )
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setClientSuggestions(data))
        .catch(() => undefined)
        .finally(() => setLoadingClients(false));
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [clientSearchTerm]);

  useEffect(() => {
    if (!slabName) {
      setSlabSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/slab-names?q=${encodeURIComponent(slabName)}`,
        {
          signal: controller.signal,
        },
      )
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setSlabSuggestions(data))
        .catch(() => undefined);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [slabName]);

  useEffect(() => {
    if (!originalClientSearchTerm) {
      setOriginalClientSuggestions([]);
      setLoadingOriginalClients(false);
      return;
    }
    const controller = new AbortController();
    setLoadingOriginalClients(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/clients?q=${encodeURIComponent(
          originalClientSearchTerm,
        )}`,
        {
          signal: controller.signal,
        },
      )
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setOriginalClientSuggestions(data))
        .catch(() => undefined)
        .finally(() => setLoadingOriginalClients(false));
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [originalClientSearchTerm]);

  useEffect(() => {
    const count = Number(quantity);
    if (!Number.isFinite(count) || count <= 0) {
      setScannerIds([]);
      return;
    }
    setScannerIds((prev) => {
      const next = [...prev];
      if (next.length === 0 && scannerId) {
        next[0] = scannerId;
      }
      if (next.length < count) {
        for (let i = next.length; i < count; i += 1) {
          next.push("");
        }
      } else if (next.length > count) {
        next.length = count;
      }
      return next;
    });
  }, [quantity, scannerId]);

  useEffect(() => {
    const count = Number(quantity);
    if (!Number.isFinite(count) || count <= 0) {
      setScannerNotes([]);
      return;
    }
    setScannerNotes((prev) => {
      const next = [...prev];
      if (count > 1 && next.length === 0 && notes.trim()) {
        next[0] = notes;
      }
      if (next.length < count) {
        for (let i = next.length; i < count; i += 1) {
          next.push("");
        }
      } else if (next.length > count) {
        next.length = count;
      }
      return next;
    });
  }, [quantity, notes]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(target)
      ) {
        setShowClientDropdown(false);
      }
      if (
        originalClientDropdownRef.current &&
        !originalClientDropdownRef.current.contains(target)
      ) {
        setShowOriginalClientDropdown(false);
      }
      if (
        slabDropdownRef.current &&
        !slabDropdownRef.current.contains(target)
      ) {
        setShowSlabDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const slabOptions = useMemo(() => {
    const filtered = fromRackId
      ? state.slabs.filter((slab) => slab.rackId === fromRackId)
      : state.slabs;
    return filtered.map((slab) => {
      const { clientName } = splitClientName(slab.clientName);
      return {
        id: slab.id,
        label: `${slab.name} (${clientName}) - ${slab.rackId.toUpperCase()}`,
      };
    });
  }, [state.slabs, fromRackId]);

  const resetForm = () => {
    setClientSearchTerm("");
    setShowClientDropdown(false);
    setClientSuggestions([]);
    setClientName("");
    setOriginalClientName("");
    setOriginalClientSearchTerm("");
    setShowOriginalClientDropdown(false);
    setOriginalClientSuggestions([]);
    setLoadingOriginalClients(false);
    setScannerId("");
    setScannerIds([]);
    setSlabName("");
    setBrand("");
    setBrandOther("");
    setThickness("");
    setBrandPickerOpen(false);
    setBrandSearchTerm("");
    setFinishPickerOpen(false);
    setFinishSearchTerm("");
    setFinishOther("");
    setThicknessPickerOpen(false);
    setTypePickerOpen(false);
    setShowSizeHDropdown(false);
    setShowSizeWDropdown(false);
    setSizeHeight("");
    setSizeWidth("");
    setFinish("");
    setNotes("");
    setScannerNotes([]);
    setJobId("");
    setQuantity("1");
    setSlabType("SLAB");
    setSlabSearchTerm("");
    setShowSlabDropdown(false);
    setActionError(null);
    setSelectedSlabId("");
    setFromRackId("");
    setMoveRackId("");
    setExitNote("");
    setConfirmOpen(false);
    setConfirmMessage("");
    setConfirmPlan([]);
    setConfirmRemaining(0);
    setPendingAdd(null);
  };

  const openLabel = (slabId: string) => {
    window.open(`/print/slab-label/${slabId}`, "_blank", "noopener,noreferrer");
  };

  const pushNotification = (
    type: "success" | "error" | "warning",
    message: string,
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  };

  const performAdd = (payload: {
    input: Omit<Slab, "id" | "createdAt" | "rackId">;
    scannerIds?: string[];
    slabNotes?: string[];
    quantity: number;
    preferredRackId?: string;
    printLabels?: boolean;
  }) => {
    const next = addMultipleSlabs(
      state,
      payload.input,
      payload.scannerIds,
      payload.slabNotes,
      payload.quantity,
      userName,
      payload.preferredRackId,
    );
    if (payload.printLabels) {
      const previousIds = new Set(state.slabs.map((slab) => slab.id));
      const createdSlabs = next.slabs.filter(
        (slab) => !previousIds.has(slab.id),
      );
      if (createdSlabs.length <= 1) {
        createdSlabs.forEach((slab) => openLabel(slab.id));
      } else {
        setPrintSelectionSlabs(
          createdSlabs.map((slab) => ({
            id: slab.id,
            scannerId: slab.scannerId,
            name: slab.name,
          })),
        );
        setPrintSelectionOpen(true);
      }
    }
    onUpdate(next);
    resetForm();
    setAction(null);
  };

  const handleAdd = (printLabels = false) => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const message = "Please enter a valid quantity greater than 0.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (!clientName.trim()) {
      const message = "Please select a client name.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (slabType === "GMD" && !originalClientName.trim()) {
      const message = "Please enter the original client for GMD slabs.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    const scannerList = qty > 1 ? scannerIds : [scannerId];
    const noteList =
      qty > 1
        ? Array.from({ length: qty }, (_, index) => scannerNotes[index] ?? "")
        : [notes];
    if (scannerList.length !== qty || scannerList.some((id) => !id.trim())) {
      const message =
        qty > 1
          ? "Please enter a D2 scanner ID for each slab."
          : "Please enter the D2 scanner ID.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (!slabName.trim()) {
      const message = "Please enter a slab name.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    const normalizedSlabName = capitalizeInput(slabName);
    const normalizedClientName = capitalizeInput(clientName);
    const normalizedOriginalClientName = capitalizeInput(originalClientName);
    const normalizedBrand =
      brand === OTHER_OPTION ? `Other - ${brandOther.trim()}` : brand.trim();
    if (!normalizedBrand) {
      const message = "Please enter the brand.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (brand === OTHER_OPTION && !brandOther.trim()) {
      const message = "Please enter the custom brand name.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    const normalizedFinish =
      finish === OTHER_OPTION ? `Other - ${finishOther.trim()}` : finish.trim();
    if (finish === OTHER_OPTION && !finishOther.trim()) {
      const message = "Please enter the custom finish name.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (!thickness.trim()) {
      const message = "Please enter thickness.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (!sizeHeight || !sizeWidth) {
      const message = "Please select slab size (H and W).";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (!selectedRack) return;
    const available =
      selectedRack.capacity - getRackLoad(state, selectedRack.id);
    const payload = {
      input: {
        scannerId: scannerList[0],
        name: normalizedSlabName,
        type: slabType,
        thickness,
        size: `${sizeHeight} x ${sizeWidth}`,
        clientName: encodeClientName(
          normalizedClientName,
          slabType === "GMD" ? normalizedOriginalClientName : undefined,
        ),
        brand: normalizedBrand,
        finish: normalizedFinish || undefined,
        notes: noteList[0]?.trim() || undefined,
        jobId: jobId.trim() || undefined,
      },
      scannerIds: scannerList,
      slabNotes: noteList,
      quantity: qty,
      preferredRackId: selectedRack.id,
      printLabels,
    };

    if (qty > available) {
      const planText = distribution?.plan
        .map((item) => `${item.count} in ${item.rackId.toUpperCase()}`)
        .join(", ");
      const remainingText =
        distribution && distribution.remaining > 0
          ? `Remaining ${distribution.remaining} will not be placed.`
          : "";
      const message = `Rack ${selectedRack.name} only has ${available} space.`;

      setPendingAdd(payload);
      setConfirmMessage(message);
      setConfirmPlan(distribution?.plan ?? []);
      setConfirmRemaining(distribution?.remaining ?? 0);
      setConfirmOpen(true);
      return;
    }

    performAdd(payload);
    pushNotification("success", "Slab entry completed successfully.");
  };

  const handleMove = () => {
    if (action === "move" && (!fromRackId || !selectedSlabId)) {
      const message = "Select a rack and slab before moving.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    if (!fromRackId || !selectedSlabId || !moveRackId) return;
    if (moveRackId !== fromRackId) {
      const targetRack = getRackById(state, moveRackId);
      if (targetRack) {
        const targetLoad = getRackLoad(state, targetRack.id);
        if (targetLoad >= targetRack.capacity) {
          const message = `Rack ${targetRack.name} is already full.`;
          setActionError(message);
          pushNotification("error", message);
          return;
        }
      }
    }
    setActionError(null);
    const next = moveSlab(state, selectedSlabId, moveRackId, userName);
    onUpdate(next);
    resetForm();
    setAction(null);
    pushNotification("success", "Slab moved successfully.");
  };

  const handleExit = () => {
    if (!fromRackId || !selectedSlabId) {
      const message = "Select a rack and slab before exiting.";
      setActionError(message);
      pushNotification("error", message);
      return;
    }
    setActionError(null);
    const next = exitSlab(state, selectedSlabId, userName, exitNote);
    onUpdate(next);
    resetForm();
    setAction(null);
    pushNotification("success", "Slab exited successfully.");
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => setAction("add")}
        >
          Add Slab
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          onClick={() => setAction("move")}
        >
          Move Slab
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          onClick={() => setAction("exit")}
        >
          Exit Slab
        </button>
      </div>

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {action === "add" && "Add new slab"}
                {action === "move" && "Move slab"}
                {action === "exit" && "Exit slab"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAction(null);
                  resetForm();
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {action === "add" && (
              <div className="mt-4 space-y-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 pl-2 mb-1">
                    Rack and client
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Rack
                      </label>
                      <select
                        value={selectedRackId}
                        onChange={(event) =>
                          setSelectedRackId(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      >
                        {sortedRacks.map((rack) => (
                          <option key={rack.id} value={rack.id}>
                            {rack.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        {slabType === "GMD" ? "New client" : "Client name"}
                      </label>
                      <div className="relative mt-1" ref={clientDropdownRef}>
                        <input
                          type="text"
                          placeholder="Search for a customer..."
                          value={clientSearchTerm}
                          onChange={(event) => {
                            setClientSearchTerm(event.target.value);
                            setShowClientDropdown(true);
                          }}
                          onFocus={() => setShowClientDropdown(true)}
                          onBlur={() => {
                            setTimeout(() => setShowClientDropdown(false), 120);
                          }}
                          disabled={Boolean(clientName)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          🔍
                        </span>
                        {showClientDropdown && clientSearchTerm.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                            {loadingClients ? (
                              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                Loading...
                              </div>
                            ) : clientSuggestions.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                No customers found
                              </div>
                            ) : (
                              <>
                                <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">
                                  Customers
                                </div>
                                {clientSuggestions.map((client) => (
                                  <button
                                    key={client}
                                    type="button"
                                    onClick={() => {
                                      setClientName(client);
                                      setClientSearchTerm(client);
                                      setShowClientDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {client}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      Customer
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {clientName && (
                        <div className="mt-2 flex items-center justify-between rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {clientName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Selected customer
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setClientName("");
                              setClientSearchTerm("");
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {slabType === "GMD" && (
                    <div className="mt-3">
                      <label className="text-xs font-medium text-gray-500">
                        Original client
                      </label>
                      <div
                        className="relative mt-1"
                        ref={originalClientDropdownRef}
                      >
                        <input
                          type="text"
                          placeholder="Search for a customer..."
                          value={originalClientSearchTerm}
                          onChange={(event) => {
                            setOriginalClientSearchTerm(event.target.value);
                            setShowOriginalClientDropdown(true);
                            if (!event.target.value) {
                              setOriginalClientName("");
                            }
                          }}
                          onFocus={() => setShowOriginalClientDropdown(true)}
                          onBlur={() => {
                            setTimeout(
                              () => setShowOriginalClientDropdown(false),
                              120,
                            );
                          }}
                          disabled={Boolean(originalClientName)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          🔍
                        </span>
                        {showOriginalClientDropdown &&
                          originalClientSearchTerm.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                              {loadingOriginalClients ? (
                                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                  Loading...
                                </div>
                              ) : originalClientSuggestions.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                  No customers found
                                </div>
                              ) : (
                                <>
                                  <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">
                                    Customers
                                  </div>
                                  {originalClientSuggestions.map((client) => (
                                    <button
                                      key={client}
                                      type="button"
                                      onClick={() => {
                                        setOriginalClientName(client);
                                        setOriginalClientSearchTerm(client);
                                        setShowOriginalClientDropdown(false);
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900 dark:text-gray-100">
                                        {client}
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Customer
                                      </div>
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                      </div>
                      {originalClientName && (
                        <div className="mt-2 flex items-center justify-between rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {originalClientName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Selected customer
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setOriginalClientName("");
                              setOriginalClientSearchTerm("");
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 pl-2 mb-1">
                    Slab selections
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Slab name
                      </label>
                      <div className="relative mt-1" ref={slabDropdownRef}>
                        <input
                          type="text"
                          placeholder="Search for a slab name..."
                          value={slabSearchTerm}
                          onChange={(event) => {
                            setSlabSearchTerm(event.target.value);
                            setSlabName(event.target.value);
                            setShowSlabDropdown(true);
                          }}
                          onFocus={() => setShowSlabDropdown(true)}
                          onBlur={() => {
                            setTimeout(() => setShowSlabDropdown(false), 120);
                          }}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          🔍
                        </span>
                        {showSlabDropdown && slabSearchTerm.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                            {slabSuggestions.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                No slab matches
                              </div>
                            ) : (
                              <>
                                <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">
                                  Slab names
                                </div>
                                {slabSuggestions.map((name) => (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => {
                                      setSlabName(name);
                                      setSlabSearchTerm(name);
                                      setShowSlabDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {name}
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Brand
                      </label>
                      <button
                        type="button"
                        onClick={() => setBrandPickerOpen(true)}
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-left text-sm"
                      >
                        {brandDisplayValue || "Select brand"}
                      </button>
                      {brand === OTHER_OPTION && (
                        <input
                          type="text"
                          value={brandOther}
                          onChange={(event) =>
                            setBrandOther(event.target.value)
                          }
                          placeholder="Type brand name..."
                          className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Thickness
                      </label>
                      <button
                        type="button"
                        onClick={() => setThicknessPickerOpen(true)}
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-left text-sm"
                      >
                        {thickness || "Select thickness"}
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Finish
                      </label>
                      <button
                        type="button"
                        onClick={() => setFinishPickerOpen(true)}
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-left text-sm"
                      >
                        {finishDisplayValue || "Select finish"}
                      </button>
                      {finish === OTHER_OPTION && (
                        <input
                          type="text"
                          value={finishOther}
                          onChange={(event) =>
                            setFinishOther(event.target.value)
                          }
                          placeholder="Type finish name..."
                          className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Type
                      </label>
                      <button
                        type="button"
                        onClick={() => setTypePickerOpen(true)}
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-left text-sm"
                      >
                        {slabType.replace(/_/g, " ")}
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Size (H)
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          placeholder="Search size..."
                          value={sizeHeight}
                          onChange={(event) => {
                            setSizeHeight(event.target.value);
                            setShowSizeHDropdown(true);
                          }}
                          onFocus={() => setShowSizeHDropdown(true)}
                          onBlur={() => {
                            setTimeout(() => setShowSizeHDropdown(false), 120);
                          }}
                          className="w-full pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {showSizeHDropdown && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                            {sizeOptions
                              .filter((opt) => opt.startsWith(sizeHeight))
                              .map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    setSizeHeight(opt);
                                    setShowSizeHDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                >
                                  {opt}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Size (W)
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          placeholder="Search size..."
                          value={sizeWidth}
                          onChange={(event) => {
                            setSizeWidth(event.target.value);
                            setShowSizeWDropdown(true);
                          }}
                          onFocus={() => setShowSizeWDropdown(true)}
                          onBlur={() => {
                            setTimeout(() => setShowSizeWDropdown(false), 120);
                          }}
                          className="w-full pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {showSizeWDropdown && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                            {sizeOptions
                              .filter((opt) => opt.startsWith(sizeWidth))
                              .map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    setSizeWidth(opt);
                                    setShowSizeWDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                >
                                  {opt}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-gray-500">
                        Job ID
                      </label>
                      <input
                        type="text"
                        placeholder="Job ID..."
                        value={jobId}
                        onChange={(event) => setJobId(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 pl-2 mb-1">
                    Scanner info &amp; notes
                  </div>
                  {Number(quantity) <= 1 ? (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          D2 Scanner ID
                        </label>
                        <input
                          value={scannerId}
                          onChange={(event) => {
                            const value = event.target.value;
                            setScannerId(value);
                            setScannerIds((prev) => {
                              const next = [...prev];
                              if (next.length === 0) next.push(value);
                              else next[0] = value;
                              return next;
                            });
                          }}
                          placeholder="D2-XXXX"
                          className="mt-1 w-full h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Notes
                        </label>
                        <textarea
                          placeholder="Optional notes..."
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={1}
                          className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {Array.from({ length: Number(quantity) }, (_, index) => {
                        const thisScannerId =
                          index === 0 ? scannerId : (scannerIds[index] ?? "");
                        const size = [sizeHeight, sizeWidth]
                          .filter(Boolean)
                          .join(" x ");
                        const previewParams = new URLSearchParams({
                          scannerId: thisScannerId,
                          name: slabName,
                          type: slabType,
                          thickness,
                          size,
                          clientName,
                          brand: brandDisplayValue,
                          finish: finishDisplayValue,
                          notes: scannerNotes[index] ?? "",
                          jobId,
                          rackId: selectedRackId,
                        });
                        const canPrint = !!thisScannerId.trim();
                        return (
                          <div
                            key={`slab-row-${index}`}
                            className="grid gap-3 items-end"
                            style={{ gridTemplateColumns: "auto 1fr 1fr" }}
                          >
                            <div className="flex flex-col items-center justify-end pb-0.5">
                              <label className="text-xs font-medium text-gray-500 mb-1">
                                Print
                              </label>
                              <button
                                type="button"
                                disabled={!canPrint}
                                onClick={() =>
                                  window.open(
                                    `/print/slab-label/preview?${previewParams.toString()}`,
                                    "_blank",
                                  )
                                }
                                className={`h-9 w-9 flex items-center justify-center rounded-lg border text-sm transition-colors ${
                                  canPrint
                                    ? "border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                                    : "border-gray-200 text-gray-300 cursor-not-allowed"
                                }`}
                                title={
                                  canPrint
                                    ? "Print label for this slab"
                                    : "Enter scanner ID first"
                                }
                              >
                                🖨️
                              </button>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">
                                Slab {index + 1} — D2 Scanner ID
                              </label>
                              {index === 0 ? (
                                <input
                                  value={scannerId}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setScannerId(value);
                                    setScannerIds((prev) => {
                                      const next = [...prev];
                                      if (next.length === 0) next.push(value);
                                      else next[0] = value;
                                      return next;
                                    });
                                  }}
                                  placeholder="D2-XXXX"
                                  className="mt-1 w-full h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                />
                              ) : (
                                <input
                                  value={scannerIds[index] ?? ""}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setScannerIds((prev) => {
                                      const next = [...prev];
                                      next[index] = value;
                                      return next;
                                    });
                                  }}
                                  placeholder={`D2-XXXX (Slab ${index + 1})`}
                                  className="mt-1 w-full h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">
                                Slab {index + 1} — Notes
                              </label>
                              <textarea
                                placeholder="Optional notes..."
                                value={scannerNotes[index] ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setScannerNotes((prev) => {
                                    const next = [...prev];
                                    next[index] = value;
                                    return next;
                                  });
                                }}
                                rows={1}
                                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 pl-2 mb-1">
                    Recommended placement
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Recommended rack
                      </label>
                      <div className="mt-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {recommendedRack?.name ?? "No rack available"}
                      </div>
                    </div>
                  </div>
                </div>
                {distribution && distribution.plan.length > 0 && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">
                      Recommended distribution:
                    </span>{" "}
                    {distribution.plan
                      .map(
                        (item) =>
                          `${item.count} in ${item.rackId.toUpperCase()}`,
                      )
                      .join(", ")}
                    {distribution.remaining > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        {" "}
                        (Remaining {distribution.remaining} not placed)
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Recommendation groups slabs by client, then fills racks up to
                  the target fill level.
                </p>
                {actionError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {actionError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAction(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdd(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add slab
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdd(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-black transition-colors"
                  >
                    Add & print label
                  </button>
                </div>
              </div>
            )}

            {brandPickerOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-md max-h-[80vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Select brand
                    </div>
                    <button
                      type="button"
                      onClick={() => setBrandPickerOpen(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="px-5 py-3">
                    <input
                      type="text"
                      value={brandSearchTerm}
                      onChange={(event) =>
                        setBrandSearchTerm(event.target.value)
                      }
                      placeholder="Search brand..."
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="max-h-[52vh] overflow-y-auto px-2 pb-4">
                    {filteredBrandOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setBrand(option);
                          if (option !== OTHER_OPTION) {
                            setBrandOther("");
                          }
                          setBrandPickerOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
                      >
                        {option === OTHER_OPTION ? "Other" : option}
                      </button>
                    ))}
                    {filteredBrandOptions.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No matches
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {finishPickerOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-md max-h-[80vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Select finish
                    </div>
                    <button
                      type="button"
                      onClick={() => setFinishPickerOpen(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="px-5 py-3">
                    <input
                      type="text"
                      value={finishSearchTerm}
                      onChange={(event) =>
                        setFinishSearchTerm(event.target.value)
                      }
                      placeholder="Search finish..."
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="max-h-[52vh] overflow-y-auto px-2 pb-4">
                    {filteredFinishOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setFinish(
                            option === OTHER_OPTION
                              ? OTHER_OPTION
                              : formatFinishOption(option),
                          );
                          if (option !== OTHER_OPTION) {
                            setFinishOther("");
                          }
                          setFinishPickerOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
                      >
                        {option === OTHER_OPTION
                          ? "Other"
                          : formatFinishOption(option)}
                      </button>
                    ))}
                    {filteredFinishOptions.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No matches
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {thicknessPickerOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-sm max-h-[70vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Select thickness
                    </div>
                    <button
                      type="button"
                      onClick={() => setThicknessPickerOpen(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto px-2 py-3">
                    {thicknessOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setThickness(option);
                          setThicknessPickerOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {typePickerOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-sm max-h-[70vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Select type
                    </div>
                    <button
                      type="button"
                      onClick={() => setTypePickerOpen(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto px-2 py-3">
                    {typeOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setSlabType((current) => {
                            if (option !== "GMD" && current === "GMD") {
                              setOriginalClientName("");
                              setOriginalClientSearchTerm("");
                              setOriginalClientSuggestions([]);
                            }
                            return option as typeof slabType;
                          });
                          setTypePickerOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
                      >
                        {option.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {confirmOpen && (
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                      Confirm
                    </h4>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                        ⚠️
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {confirmMessage}
                        </div>
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          We will place what fits using the recommended
                          distribution.
                        </div>
                      </div>
                    </div>

                    {confirmPlan.length > 0 && (
                      <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Placement summary
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {confirmPlan.map((item) => (
                            <span
                              key={`${item.rackId}-${item.count}`}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 text-xs font-semibold"
                            >
                              <span className="text-sm">{item.count}</span>
                              <span className="text-[10px] uppercase">
                                in {item.rackId}
                              </span>
                            </span>
                          ))}
                        </div>
                        {confirmRemaining > 0 && (
                          <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                            Remaining {confirmRemaining} will not be placed.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingAdd) performAdd(pendingAdd);
                        setConfirmOpen(false);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {printSelectionOpen && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                      Print slab labels
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintSelectionOpen(false);
                        setPrintSelectionSlabs([]);
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="px-6 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Choose which labels to print now.
                    </p>
                    {printSelectionSlabs.map((slab) => (
                      <div
                        key={slab.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {slab.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {slab.scannerId || slab.id}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            openLabel(slab.id);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Print
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => {
                        setPrintSelectionOpen(false);
                        setPrintSelectionSlabs([]);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        printSelectionSlabs.forEach((slab) =>
                          openLabel(slab.id),
                        );
                        setPrintSelectionOpen(false);
                        setPrintSelectionSlabs([]);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-black transition-colors"
                    >
                      Print all
                    </button>
                  </div>
                </div>
              </div>
            )}

            {action === "move" && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      From
                    </h4>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Rack
                        </label>
                        <select
                          value={fromRackId}
                          onChange={(event) =>
                            setFromRackId(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        >
                          <option value="">Select rack</option>
                          {sortedRacks.map((rack) => (
                            <option key={rack.id} value={rack.id}>
                              {rack.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Slab
                        </label>
                        <select
                          value={selectedSlabId}
                          onChange={(event) =>
                            setSelectedSlabId(event.target.value)
                          }
                          disabled={!fromRackId}
                          className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        >
                          <option value="">Select slab</option>
                          {slabOptions.map((slab) => (
                            <option key={slab.id} value={slab.id}>
                              {slab.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      To
                    </h4>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Target rack
                        </label>
                        <select
                          value={moveRackId}
                          onChange={(event) =>
                            setMoveRackId(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        >
                          <option value="">Select rack</option>
                          {sortedRacks.map((rack) => (
                            <option key={rack.id} value={rack.id}>
                              {rack.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAction(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleMove}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Move slab
                  </button>
                </div>
                {actionError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {actionError}
                  </p>
                )}
              </div>
            )}

            {action === "exit" && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Rack
                    </label>
                    <select
                      value={fromRackId}
                      onChange={(event) => setFromRackId(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="">Select rack</option>
                      {sortedRacks.map((rack) => (
                        <option key={rack.id} value={rack.id}>
                          {rack.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      Slab
                    </label>
                    <select
                      value={selectedSlabId}
                      onChange={(event) =>
                        setSelectedSlabId(event.target.value)
                      }
                      disabled={!fromRackId}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="">Select slab</option>
                      {slabOptions.map((slab) => (
                        <option key={slab.id} value={slab.id}>
                          {slab.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Exit notes
                  </label>
                  <textarea
                    value={exitNote}
                    onChange={(event) => setExitNote(event.target.value)}
                    placeholder="Reason for exit (e.g., countertop, sink, etc.)"
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAction(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExit}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Exit slab
                  </button>
                </div>
                {actionError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {actionError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
          {notifications.map((note) => {
            const styleMap = {
              success: "bg-emerald-600 text-white border-emerald-700",
              error: "bg-red-600 text-white border-red-700",
              warning: "bg-amber-500 text-white border-amber-600",
            } as const;
            const iconMap = {
              success: "✓",
              error: "✕",
              warning: "!",
            } as const;
            return (
              <div
                key={note.id}
                className={`rounded-lg border shadow-lg px-4 py-3 flex items-start justify-between gap-3 ${styleMap[note.type]}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                    {iconMap[note.type]}
                  </div>
                  <div className="text-sm font-medium">{note.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifications((prev) =>
                      prev.filter((item) => item.id !== note.id),
                    )
                  }
                  className="text-white/80 hover:text-white"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
