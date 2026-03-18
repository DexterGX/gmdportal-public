"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createExpectedDelivery,
  deleteExpectedDelivery,
  fetchExpectedDeliveries,
  type SlabDeliveryExpectation,
  type SlabDeliveryType,
} from "../ui/expectedDeliveries";

const OTHER_OPTION = "OTHER";

const thicknessOptions = ["6mm", "8mm", "10mm", "12mm", "2cm", "3cm"];
const typeOptions: SlabDeliveryType[] = [
  "SLAB",
  "GMD",
  "REMNANT",
  "RESERVED",
  "CLIENT_SLAB",
];
const brandOptions = [
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
];
const finishOptions = [
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

const capitalizeInput = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /(^|[\s-])([a-z])/g,
      (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
    );

export default function SlabDeliveryClient({ userName }: { userName: string }) {
  const [deliveries, setDeliveries] = useState<SlabDeliveryExpectation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [originalClientName, setOriginalClientName] = useState("");
  const [originalClientSearchTerm, setOriginalClientSearchTerm] = useState("");
  const [originalClientSuggestions, setOriginalClientSuggestions] = useState<
    string[]
  >([]);
  const [showOriginalClientDropdown, setShowOriginalClientDropdown] =
    useState(false);
  const [loadingOriginalClients, setLoadingOriginalClients] = useState(false);
  const [slabName, setSlabName] = useState("");
  const [slabSearchTerm, setSlabSearchTerm] = useState("");
  const [slabSuggestions, setSlabSuggestions] = useState<string[]>([]);
  const [showSlabDropdown, setShowSlabDropdown] = useState(false);
  const [brand, setBrand] = useState("");
  const [brandOther, setBrandOther] = useState("");
  const [thickness, setThickness] = useState("");
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [brandSearchTerm, setBrandSearchTerm] = useState("");
  const [finish, setFinish] = useState("");
  const [finishPickerOpen, setFinishPickerOpen] = useState(false);
  const [finishSearchTerm, setFinishSearchTerm] = useState("");
  const [finishOther, setFinishOther] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [slabType, setSlabType] = useState<SlabDeliveryType>("SLAB");
  const [thicknessPickerOpen, setThicknessPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [extraNotes, setExtraNotes] = useState<string[]>([]);
  const clientDropdownRef = useRef<HTMLDivElement | null>(null);
  const originalClientDropdownRef = useRef<HTMLDivElement | null>(null);
  const slabDropdownRef = useRef<HTMLDivElement | null>(null);

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
  const filteredBrandOptions = useMemo(() => {
    const term = brandSearchTerm.trim().toLowerCase();
    if (!term) return brandOptions;
    return brandOptions.filter((option) => option.toLowerCase().includes(term));
  }, [brandSearchTerm]);
  const filteredFinishOptions = useMemo(() => {
    const term = finishSearchTerm.trim().toLowerCase();
    if (!term) return finishOptions;
    return finishOptions.filter((option) =>
      formatFinishOption(option).toLowerCase().includes(term),
    );
  }, [finishSearchTerm]);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      setError(null);
      setDeliveries(await fetchExpectedDeliveries());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load expected deliveries.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDeliveries();
  }, []);

  useEffect(() => {
    const count = Math.max(Number(quantity) - 1, 0);
    if (!Number.isFinite(count)) {
      setExtraNotes([]);
      return;
    }

    setExtraNotes((prev) => {
      const next = [...prev];
      if (next.length < count) {
        for (let index = next.length; index < count; index += 1) {
          next.push("");
        }
      } else if (next.length > count) {
        next.length = count;
      }
      return next;
    });
  }, [quantity]);

  useEffect(() => {
    if (!clientSearchTerm.trim()) {
      setClientSuggestions([]);
      setLoadingClients(false);
      return;
    }

    const controller = new AbortController();
    setLoadingClients(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/clients?q=${encodeURIComponent(clientSearchTerm)}`,
        { signal: controller.signal },
      )
        .then((response) => (response.ok ? response.json() : []))
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
    if (!originalClientSearchTerm.trim()) {
      setOriginalClientSuggestions([]);
      setLoadingOriginalClients(false);
      return;
    }

    const controller = new AbortController();
    setLoadingOriginalClients(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/clients?q=${encodeURIComponent(originalClientSearchTerm)}`,
        { signal: controller.signal },
      )
        .then((response) => (response.ok ? response.json() : []))
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
    if (!slabSearchTerm.trim()) {
      setSlabSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `/api/slab-rack-display/slab-names?q=${encodeURIComponent(slabSearchTerm)}`,
        { signal: controller.signal },
      )
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => setSlabSuggestions(data))
        .catch(() => undefined);
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [slabSearchTerm]);

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

  const summary = useMemo(
    () => ({
      total: deliveries.length,
      totalSlabs: deliveries.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [deliveries],
  );

  const resetForm = () => {
    setClientName("");
    setClientSearchTerm("");
    setClientSuggestions([]);
    setShowClientDropdown(false);
    setOriginalClientName("");
    setOriginalClientSearchTerm("");
    setOriginalClientSuggestions([]);
    setShowOriginalClientDropdown(false);
    setSlabName("");
    setSlabSearchTerm("");
    setSlabSuggestions([]);
    setShowSlabDropdown(false);
    setBrand("");
    setBrandOther("");
    setBrandPickerOpen(false);
    setBrandSearchTerm("");
    setThickness("");
    setFinish("");
    setFinishPickerOpen(false);
    setFinishSearchTerm("");
    setFinishOther("");
    setQuantity("1");
    setSlabType("SLAB");
    setThicknessPickerOpen(false);
    setTypePickerOpen(false);
    setJobId("");
    setNotes("");
    setExtraNotes([]);
    setError(null);
  };

  const handleCreate = async () => {
    const parsedQuantity = Number(quantity);
    const normalizedBrand =
      brand === OTHER_OPTION ? `Other - ${brandOther.trim()}` : brand.trim();
    const normalizedFinish =
      finish === OTHER_OPTION ? `Other - ${finishOther.trim()}` : finish.trim();

    if (!clientName.trim()) {
      setError("Please select a client name.");
      return;
    }
    if (slabType === "GMD" && !originalClientName.trim()) {
      setError("Please enter the original client for GMD slabs.");
      return;
    }
    if (!slabName.trim()) {
      setError("Please enter a slab name.");
      return;
    }
    if (!normalizedBrand) {
      setError("Please enter the brand.");
      return;
    }
    if (brand === OTHER_OPTION && !brandOther.trim()) {
      setError("Please enter the custom brand name.");
      return;
    }
    if (!thickness.trim()) {
      setError("Please select thickness.");
      return;
    }
    if (!normalizedFinish) {
      setError("Please select finish.");
      return;
    }
    if (finish === OTHER_OPTION && !finishOther.trim()) {
      setError("Please enter the custom finish name.");
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Please enter a valid quantity greater than 0.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const created = await createExpectedDelivery({
        clientName: capitalizeInput(clientName),
        originalClientName:
          slabType === "GMD" ? capitalizeInput(originalClientName) : undefined,
        slabName: capitalizeInput(slabName),
        brand: normalizedBrand,
        thickness,
        finish: normalizedFinish,
        quantity: parsedQuantity,
        slabType,
        jobId: jobId.trim() || undefined,
        notes: notes.trim() || undefined,
        extraNotes: extraNotes.map((note) => note.trim()).filter(Boolean),
      });
      setDeliveries((prev) => [created, ...prev]);
      resetForm();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create expected delivery.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deliveryId: string) => {
    const previous = deliveries;
    setDeliveries((prev) => prev.filter((item) => item.id !== deliveryId));

    try {
      await deleteExpectedDelivery(deliveryId);
    } catch (deleteError) {
      setDeliveries(previous);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to remove expected delivery.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Slab Delivery
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Prepare expected slab deliveries so the warehouse team can finish
            the intake faster in SlabBay.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center dark:border-amber-800 dark:bg-amber-900/20">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Deliveries
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">
              {summary.total}
            </div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Slabs queued
            </div>
            <div className="mt-1 text-2xl font-semibold text-blue-900 dark:text-blue-100">
              {summary.totalSlabs}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              New expected delivery
            </h2>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Created by {userName}
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="border-l-2 border-blue-500 pl-2 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Client and slab
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    {slabType === "GMD" ? "New client" : "Client name"}
                  </label>
                  <div className="relative mt-1" ref={clientDropdownRef}>
                    <input
                      type="text"
                      value={clientSearchTerm}
                      placeholder="Search for a customer..."
                      onChange={(event) => {
                        setClientSearchTerm(event.target.value);
                        setShowClientDropdown(true);
                        if (!event.target.value) {
                          setClientName("");
                        }
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      disabled={Boolean(clientName)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      🔍
                    </span>
                    {showClientDropdown && clientSearchTerm.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {loadingClients ? (
                          <div className="p-4 text-center text-gray-500">
                            Loading...
                          </div>
                        ) : clientSuggestions.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            No customers found
                          </div>
                        ) : (
                          clientSuggestions.map((client) => (
                            <button
                              key={client}
                              type="button"
                              onClick={() => {
                                setClientName(client);
                                setClientSearchTerm(client);
                                setShowClientDropdown(false);
                              }}
                              className="w-full border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 last:border-b-0 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-700"
                            >
                              {client}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {clientName && (
                    <div className="mt-2 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {clientName}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setClientName("");
                          setClientSearchTerm("");
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Slab name
                  </label>
                  <div className="relative mt-1" ref={slabDropdownRef}>
                    <input
                      type="text"
                      value={slabSearchTerm}
                      placeholder="Search for a slab name..."
                      onChange={(event) => {
                        setSlabSearchTerm(event.target.value);
                        setSlabName(event.target.value);
                        setShowSlabDropdown(true);
                      }}
                      onFocus={() => setShowSlabDropdown(true)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      🔍
                    </span>
                    {showSlabDropdown && slabSearchTerm.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {slabSuggestions.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            No slab matches
                          </div>
                        ) : (
                          slabSuggestions.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSlabName(name);
                                setSlabSearchTerm(name);
                                setShowSlabDropdown(false);
                              }}
                              className="w-full border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 last:border-b-0 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-700"
                            >
                              {name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
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
                      value={originalClientSearchTerm}
                      placeholder="Search for a customer..."
                      onChange={(event) => {
                        setOriginalClientSearchTerm(event.target.value);
                        setShowOriginalClientDropdown(true);
                        if (!event.target.value) {
                          setOriginalClientName("");
                        }
                      }}
                      onFocus={() => setShowOriginalClientDropdown(true)}
                      disabled={Boolean(originalClientName)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      🔍
                    </span>
                    {showOriginalClientDropdown &&
                      originalClientSearchTerm.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                          {loadingOriginalClients ? (
                            <div className="p-4 text-center text-gray-500">
                              Loading...
                            </div>
                          ) : originalClientSuggestions.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                              No customers found
                            </div>
                          ) : (
                            originalClientSuggestions.map((client) => (
                              <button
                                key={client}
                                type="button"
                                onClick={() => {
                                  setOriginalClientName(client);
                                  setOriginalClientSearchTerm(client);
                                  setShowOriginalClientDropdown(false);
                                }}
                                className="w-full border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 last:border-b-0 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-700"
                              >
                                {client}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                  </div>
                  {originalClientName && (
                    <div className="mt-2 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {originalClientName}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOriginalClientName("");
                          setOriginalClientSearchTerm("");
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="border-l-2 border-blue-500 pl-2 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Delivery details
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Brand
                  </label>
                  <button
                    type="button"
                    onClick={() => setBrandPickerOpen(true)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {brandDisplayValue || "Select brand"}
                  </button>
                  {brand === OTHER_OPTION && (
                    <input
                      type="text"
                      value={brandOther}
                      onChange={(event) => setBrandOther(event.target.value)}
                      placeholder="Type brand name..."
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {finishDisplayValue || "Select finish"}
                  </button>
                  {finish === OTHER_OPTION && (
                    <input
                      type="text"
                      value={finishOther}
                      onChange={(event) => setFinishOther(event.target.value)}
                      placeholder="Type finish name..."
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Type
                  </label>
                  <button
                    type="button"
                    onClick={() => setTypePickerOpen(true)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {slabType.replace(/_/g, " ")}
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500">
                    Job ID
                  </label>
                  <input
                    type="text"
                    value={jobId}
                    onChange={(event) => setJobId(event.target.value)}
                    placeholder="Job ID..."
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="border-l-2 border-blue-500 pl-2 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Notes
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Notes for slab 1
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional notes..."
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                {extraNotes.map((note, index) => (
                  <div key={`extra-note-${index}`}>
                    <label className="text-xs font-medium text-gray-500">
                      Notes for slab {index + 2}
                    </label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(event) => {
                        const value = event.target.value;
                        setExtraNotes((prev) => {
                          const next = [...prev];
                          next[index] = value;
                          return next;
                        });
                      }}
                      placeholder={`Optional notes for slab ${index + 2}...`}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save expected delivery"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Pending expected deliveries
            </h2>
            <button
              type="button"
              onClick={() => void loadDeliveries()}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Loading expected deliveries...
              </div>
            ) : deliveries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No pending deliveries yet.
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {delivery.slabName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {delivery.clientName}
                        {delivery.originalClientName
                          ? ` / ${delivery.originalClientName}`
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(delivery.id)}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      {delivery.quantity} slab
                      {delivery.quantity === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {delivery.slabType.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {delivery.brand}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {delivery.thickness}
                    </span>
                    {delivery.finish && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {delivery.finish}
                      </span>
                    )}
                  </div>

                  {(delivery.jobId ||
                    delivery.notes ||
                    delivery.extraNotes.length > 0) && (
                    <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                      {delivery.jobId && <div>Job ID: {delivery.jobId}</div>}
                      {delivery.notes && (
                        <div>Slab 1 notes: {delivery.notes}</div>
                      )}
                      {delivery.extraNotes.map((note, index) => (
                        <div key={`${delivery.id}-note-${index}`}>
                          Slab {index + 2} notes: {note}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Created by {delivery.createdBy} on{" "}
                    {new Date(delivery.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {brandPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
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
                onChange={(event) => setBrandSearchTerm(event.target.value)}
                placeholder="Search brand..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
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
                  className="w-full rounded-md px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
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
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
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
                onChange={(event) => setFinishSearchTerm(event.target.value)}
                placeholder="Search finish..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
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
                  className="w-full rounded-md px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
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
          <div className="max-h-[70vh] w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
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
                  className="w-full rounded-md px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
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
          <div className="max-h-[70vh] w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
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
                        setShowOriginalClientDropdown(false);
                      }
                      return option;
                    });
                    setTypePickerOpen(false);
                  }}
                  className="w-full rounded-md px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  {option.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
