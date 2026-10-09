"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import RoundedSelect from "@/components/forms/RoundedSelect";
import InfoPopover from "@/components/forms/InfoPopover";
import CopyQBooksButton from "./CopyQBooksButton";
import { useRouter, useSearchParams } from "next/navigation";
import { isPriceLockExpired, PRICE_LOCK_DAYS } from "@/lib/cabinetPriceLock";
import { Plus, Trash2, Save, Printer, RotateCcw, ClipboardList, DollarSign } from "lucide-react";
import {
  computeLineItemTotal,
  computeCabinetsTotal,
  computeCabinetEstimateFooterTotals,
  computeDiscountAmount,
  computeLineItemsCustomizationSurchargeTotal,
  computeSpecialCustomizationTotal,
  computeBaseInstallationAmount,
  computeRemovalAmount,
  discountPercentLabel,
  DISCOUNT_PERCENT_OPTIONS,
  formatCurrency,
  generateRandomDigits,
  formatEstimateReferenceNumber,
  computeCabinetsCost,
} from "@/lib/cabinetEstimateCalc";
import {
  computeMicrowaveInstallationAmount,
  findMicrowaveServiceItem,
  installationServiceItemPricesById,
} from "@/lib/cabinetEstimateParameters";
import {
  computeCostSummary,
  computeInstallerCost,
  costsByItemIdForInstaller,
} from "@/lib/cabinetCostView";

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

type CabinetSummaryBucket = "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC";

type LineItem = {
  key: string;
  qty: number;
  code: string;
  description: string;
  isCustomization: boolean;
  note: string;
  // null means this row is linked to a catalog item but that item has
  // no price at the currently selected vendor/tier - rendered as N/A
  // and highlighted, rather than a misleading $0.00. A row with no
  // catalogItemId (blank, or a manually-typed code with no match)
  // still just uses 0, unchanged from before.
  unitPrice: number | null;
  // Set when this row was filled in from the price catalog (see the Code
  // autocomplete) - drives the auto-computed Cabinets Summary counts below.
  // Manually-typed rows keep both null and simply don't count toward any bucket.
  catalogItemId: string | null;
  summaryBucket: CabinetSummaryBucket | null;
  // Snapshotted from the catalog item's installationItemId at selection
  // time (round 11) - which row of the Installers Price Table prices this
  // line's installation. Null if unmatched/manually typed - contributes
  // $0 to the per-item Installation total, same tolerant behavior as a
  // missing summaryBucket already has for Cabinets Summary.
  installationItemId: string | null;
  // Round 13: reference photo cropped from the vendor's catalog PDF (see
  // CabinetCatalogItem.catalogImageUrl), snapshotted at selection time
  // purely for display - never persisted with the estimate, never used in
  // any pricing/summary calc. Null for manually-typed rows or when no
  // catalog image has been extracted for this item yet.
  catalogImageUrl: string | null;
};

type CatalogVendor = { id: string; name: string; displayName: string; factor?: number | null };
type CatalogPriceTier = { id: string; name: string };
type CatalogItemSuggestion = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  installationItemId: string | null;
  catalogImageUrl: string | null;
  unitPrice: number | null;
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
    note: "",
    unitPrice: 0,
    catalogItemId: null,
    summaryBucket: null,
    installationItemId: null,
    catalogImageUrl: null,
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
    (item.unitPrice === 0 || item.unitPrice == null)
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Grows a Note textarea to fit its content instead of clipping - called on
// mount (so a loaded estimate's long notes show in full immediately) and
// on every keystroke.
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

type Props = {
  currentUserName: string;
  // Admins, finance and Program Admins only - may open the Preco de Custo view.
  canViewCost: boolean;
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
  const [vendorId, setVendorId] = useState("");
  const [priceTierId, setPriceTierId] = useState("");
  const [vendors, setVendors] = useState<CatalogVendor[]>([]);
  const [priceTiers, setPriceTiers] = useState<CatalogPriceTier[]>([]);
  // Round 12: Removal is no longer free text/a manual $ amount - the user
  // picks a Removal Type (GMD-Parameters-managed) and every dollar is
  // computed from its percent x the Cabinets total, same "users pick, the
  // system prices" pattern Installation Type already established (round 9).
  // Optional/blank by default, unlike Installation Type - not every
  // estimate has a removal.
  const [removalTypeId, setRemovalTypeId] = useState("");
  // Round 12: Project Type is still a plain string (no calc tied to it
  // yet, per Diego's explicit "for now" scoping) but is now chosen from a
  // GMD-Parameters-managed list instead of typed freely.
  const [projectType, setProjectType] = useState("");
  // Version is stamped by the server (program/table version at save time) -
  // never typed. `versionActual` only differs from `version` when an admin
  // logged an update as "don't show publicly".
  const [version, setVersion] = useState("");
  const [versionActual, setVersionActual] = useState("");
  // Remeasure PK List: the remeasure team re-creates a sold estimate with what
  // will actually be ordered. See the save logic in handleSave.
  const [isRemeasure, setIsRemeasure] = useState(false);
  const [loadedIsRemeasure, setLoadedIsRemeasure] = useState(false);
  const [originalEstimate, setOriginalEstimate] = useState<{
    id: string;
    estimateNumber: string | null;
  } | null>(null);
  const [remeasureEstimates, setRemeasureEstimates] = useState<
    { id: string; estimateNumber: string | null }[]
  >([]);
  // "Preco de Custo": view-only toggle that shows line prices at vendor cost.
  const [showCost, setShowCost] = useState(false);
  const [remeasureByName, setRemeasureByName] = useState("");
  // Preco de Custo data (installers + their cost table + tax %), fetched the
  // first time the view is turned on.
  const [costData, setCostData] = useState<{
    installers: { id: string; name: string }[];
    costs: { installerId: string; itemId: string; cost: number }[];
    taxPercent: number;
  } | null>(null);
  const [costInstallerId, setCostInstallerId] = useState("");
  // "Unsaved changes" prompt shown before Print / PK List.
  const [printPrompt, setPrintPrompt] = useState<"normal" | "pk" | "cost" | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  // Set when a reopened estimate is past the price lock: its catalog prices get
  // refreshed once the form has finished loading (see the effect below).
  const [repriceOnOpen, setRepriceOnOpen] = useState<{ vendorId: string; tierId: string } | null>(
    null,
  );
  const remeasureBackup = useRef<LineItem[] | null>(null);
  const snapshotForId = useRef<string | null>(null);

  const [lineItems, setLineItems] = useState<LineItem[]>(() =>
    makeBlankRows(MIN_BLANK_ROWS),
  );
  // Refs to the Code/Note inputs, keyed by "rowIndex:field" - lets Enter in
  // one of those cells move focus straight down to the same cell in the
  // next row, spreadsheet-style (see handleAdvanceRowKeyDown).
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  function registerCellRef(
    index: number,
    field: "code" | "note",
    el: HTMLInputElement | HTMLTextAreaElement | null,
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

  // Standard/Double/Custom/Misc counts, and Quantity of Items below, are
  // no longer manual entry - they're computed (see cabinetsSummaryCounts
  // and totalItemsQuantity) from the line items themselves, the same way
  // cabinetsTotal is computed.
  const [microwaveInstallation, setMicrowaveInstallation] = useState(false);
  // Stable for the life of this form session (not regenerated on every
  // keystroke/total change) - only the cost-derived groups in
  // formatEstimateReferenceNumber update live as the total changes.
  const [referenceRandomDigits] = useState(() => generateRandomDigits(8));
  // Catalog image pop-up (opened from a row's thumbnail) instead of a new tab.
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    code: string;
    description: string;
  } | null>(null);
  useEffect(() => {
    if (!imagePreview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setImagePreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imagePreview]);

  const [discountPercent, setDiscountPercent] = useState(0);
  // Round 9: Installation is no longer a typed $ amount - the user only
  // picks an Installation Type, and every dollar is computed from the
  // GMD Parameters fetched below (see the useEffect a bit further down).
  const [installationTypeId, setInstallationTypeId] = useState("");
  const [gmdParameters, setGmdParameters] = useState<{
    settings: {
      installationBasePercent: number;
      installationCalcMode: "flat" | "perItem" | "higher";
      customSurchargePercent: number;
      costTaxPercent?: number;
    };
    installationServiceItems: { id: string; code: string | null; description: string; salePrice: number }[];
    installationTypes: {
      id: string;
      name: string;
      description?: string;
      multiplier: number;
      isActive: boolean;
    }[];
    programVersion?: { public: string; actual: string | null };
    removalTypes: {
      id: string;
      name: string;
      percent: number;
      isActive: boolean;
    }[];
    discountOptions?: {
      id: string;
      percent: number;
      label: string;
      isActive: boolean;
    }[];
    projectTypes: {
      id: string;
      name: string;
      isActive: boolean;
    }[];
  }>({
    settings: { installationBasePercent: 15, installationCalcMode: "higher", customSurchargePercent: 0 },
    installationServiceItems: [],
    installationTypes: [],
    removalTypes: [],
    projectTypes: [],
    discountOptions: [],
  });
  // Special Customization - an admin-managed catalog of customization types
  // (see GMD Parameters > Cabinet Estimates). The user just picks a qty per type;
  // the $ amount is always derived from the catalog price, never typed in.
  const [specialCustomizationQtyById, setSpecialCustomizationQtyById] = useState<
    Record<string, number>
  >({});
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(Boolean(editEstimateId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [specialCustomizationSearch, setSpecialCustomizationSearch] = useState("");

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
    snapshotForId.current = null;
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
        // Keep the linked job on re-save (it used to be dropped to null).
        setSelectedJobId(json.jobId || "");
        setSalesRep(json.salesRep || "");
        setBrand(json.brand || "");
        setGroupColor(json.groupColor || "");
        setVendorId(json.vendorId || "");
        setPriceTierId(json.priceTierId || "");
        setRemovalTypeId(json.removalTypeId || "");
        setProjectType(json.projectType || "");
        setVersion(json.version || "");
        setVersionActual(json.versionActual || "");
        setIsRemeasure(Boolean(json.isRemeasure));
        setLoadedIsRemeasure(Boolean(json.isRemeasure));
        setOriginalEstimate(json.originalEstimate || null);
        setRemeasureEstimates(json.remeasureEstimates || []);
        setRemeasureByName(json.remeasureByName || "");
        remeasureBackup.current = null;
        setRepriceOnOpen(
          json.vendorId && isPriceLockExpired(json.pricedAt || json.createdAt)
            ? { vendorId: json.vendorId, tierId: json.priceTierId || "" }
            : null,
        );
        setMicrowaveInstallation(Boolean(json.microwaveInstallation));
        setDiscountPercent(json.discountPercent || 0);
        setInstallationTypeId(json.installationTypeId || "");
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
                note: item.note || "",
                unitPrice: item.unitPrice ?? 0,
                catalogItemId: item.catalogItemId || null,
                summaryBucket: item.summaryBucket || null,
                // Not stored with the estimate (it's a live reference to the
                // catalog, not a snapshot) - backfilled just below, by
                // catalogItemId only, so it shows up on a saved/reopened
                // estimate without touching its saved price/description.
                catalogImageUrl: null,
              }))
            : makeBlankRows(MIN_BLANK_ROWS),
        );

        // Backfill reference images for a reopened estimate. Deliberately
        // separate from repriceCatalogItems (used when Brand/Group-Color
        // changes) - that function also overwrites price/description/
        // bucket from the CURRENT catalog, which would silently drift a
        // saved estimate's locked-in numbers. This only ever touches
        // catalogImageUrl, a purely cosmetic field, leaving everything
        // else exactly as saved.
        const catalogItemIds = Array.from(
          new Set(
            (json.lineItems || [])
              .map((item: any) => item.catalogItemId)
              .filter((id: unknown): id is string => Boolean(id)),
          ),
        );
        if (catalogItemIds.length > 0 && json.vendorId) {
          try {
            const imgParams = new URLSearchParams({
              vendorId: json.vendorId,
              ids: catalogItemIds.join(","),
            });
            if (json.priceTierId) imgParams.set("tierId", json.priceTierId);
            const imgRes = await fetch(`/api/cabinet-catalog/items?${imgParams.toString()}`);
            const imgJson = await imgRes.json();
            if (imgRes.ok) {
              const imageByCatalogId = new Map<string, string | null>(
                (imgJson.items || []).map((it: any) => [it.id, it.catalogImageUrl || null]),
              );
              setLineItems((prev) =>
                prev.map((item) =>
                  item.catalogItemId && imageByCatalogId.has(item.catalogItemId)
                    ? { ...item, catalogImageUrl: imageByCatalogId.get(item.catalogItemId) ?? null }
                    : item,
                ),
              );
            }
          } catch {
            // non-fatal - saved estimate just won't show a reference image
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load estimate");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEstimateId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cabinet-catalog/vendors");
        const json = await res.json();
        if (res.ok) setVendors(json.vendors || []);
      } catch {
        // non-fatal - Brand/Group-Color selects just show no catalog options
      }
    })();
  }, []);

  // GMD Parameters (round 9) - the admin-tunable numbers behind the
  // Installation auto-calculation. Fetched once for a live preview as the
  // user works; the persisted number always comes from the server, which
  // re-fetches these itself rather than trusting anything computed here.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cabinet-estimates/parameters");
        const json = await res.json();
        if (!res.ok) return;
        setGmdParameters(json);
        // A brand-new estimate (never one being loaded for edit) defaults
        // to the first active Installation Type so the select isn't blank.
        if (!editEstimateId) {
          setInstallationTypeId((prev) => {
            if (prev) return prev;
            const types = json.installationTypes || [];
            const firstActive = types.find((t: any) => t.isActive) || types[0];
            return firstActive?.id || "";
          });
        }
      } catch {
        // non-fatal - Installation just shows $0 until this loads
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setPriceTiers([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/cabinet-catalog/vendors/${vendorId}/tiers`);
        const json = await res.json();
        if (res.ok) setPriceTiers(json.tiers || []);
      } catch {
        setPriceTiers([]);
      }
    })();
  }, [vendorId]);

  // Item-code autocomplete for the table below: query the selected vendor's
  // (and, when picked, price tier's) catalog as the user types a code.
  const [codeQuery, setCodeQuery] = useState<{ index: number; text: string } | null>(null);
  const [codeSuggestions, setCodeSuggestions] = useState<CatalogItemSuggestion[]>([]);
  const [codeDropdownRect, setCodeDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const codeDropdownRef = useRef<HTMLDivElement | null>(null);

  // Special Customization sidebar height sync - it should line up with the
  // bottom of the Notes/Cabinets Summary/Total Summary row on the left,
  // not run on past it (or leave empty space above it). ResizeObserver on
  // the left column (header + item table + footer row) picks up both the
  // item table growing (more rows added) and the footer's own natural
  // height, so the sidebar's height - and therefore how much of its own
  // item list needs to scroll internally - stays in sync automatically
  // rather than needing a fixed guess or a CSS-only trick (this project's
  // standing lesson from the sticky-column/dropdown-portal fixes is that
  // CSS alone tends to be flaky for this kind of cross-sibling sizing).
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const [leftColumnHeight, setLeftColumnHeight] = useState<number | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktopLayout(mql.matches);
    const handleChange = () => setIsDesktopLayout(mql.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !leftColumnRef.current) return;
    const el = leftColumnRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setLeftColumnHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!codeQuery || !vendorId || !codeQuery.text.trim()) {
      setCodeSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ vendorId, q: codeQuery.text.trim() });
        if (priceTierId) params.set("tierId", priceTierId);
        const res = await fetch(`/api/cabinet-catalog/items?${params.toString()}`);
        const json = await res.json();
        if (res.ok) setCodeSuggestions(json.items || []);
      } catch {
        setCodeSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [codeQuery, vendorId, priceTierId]);
  // Close the code-search dropdown on any scroll or resize so it never
  // renders in a stale position. It's rendered via a portal (see the
  // codeSuggestions dropdown below) specifically so it can escape the item
  // table's `overflow-hidden` wrapper, which otherwise clipped it whenever
  // a suggestion list needed to extend past the table's own bottom edge.
  useEffect(() => {
    // Scrolling *inside* the suggestions list itself also fires a capturing
    // "scroll" event on window (a capture-phase listener on an ancestor
    // still runs even though "scroll" doesn't bubble) - ignore those so the
    // list doesn't slam shut the instant someone tries to scroll through
    // more matches than fit on screen. Any other scroll (the page, the item
    // table's own horizontal scroll container, etc.) still closes it so it
    // never renders in a stale position.
    function closeCodeDropdown(event: Event) {
      if (
        codeDropdownRef.current &&
        event.target instanceof Node &&
        codeDropdownRef.current.contains(event.target)
      ) {
        return;
      }
      setCodeQuery((q) => (q ? null : q));
    }
    window.addEventListener("scroll", closeCodeDropdown, true);
    window.addEventListener("resize", closeCodeDropdown);
    return () => {
      window.removeEventListener("scroll", closeCodeDropdown, true);
      window.removeEventListener("resize", closeCodeDropdown);
    };
  }, []);


  function selectCatalogItem(index: number, suggestion: CatalogItemSuggestion) {
    updateItem(index, {
      code: suggestion.code,
      description: suggestion.description,
      // Preserve null (no price at this vendor/tier) instead of
      // silently defaulting to 0 - see the N/A rendering below.
      unitPrice: suggestion.unitPrice,
      catalogItemId: suggestion.id,
      summaryBucket: suggestion.summaryBucket,
      installationItemId: suggestion.installationItemId,
      catalogImageUrl: suggestion.catalogImageUrl,
    });
    setCodeQuery(null);
  }

  // Kept in sync with lineItems so repriceCatalogItems (below) always reads
  // the latest rows without needing to be in that callback's dependency
  // array (it's called directly from onChange handlers, not an effect).
  const lineItemsRef = useRef<LineItem[]>(lineItems);
  useEffect(() => {
    lineItemsRef.current = lineItems;
  }, [lineItems]);

  // Re-fetch price (and description/bucket, in case those ever change too)
  // for every line item already linked to a catalog item, for the given
  // vendor/tier - this is what makes swapping Group/Color (or re-picking
  // the same Brand) instantly re-price already-added rows instead of
  // leaving their old price stale until the user re-picks the code.
  async function repriceCatalogItems(forVendorId: string, forTierId: string): Promise<number> {
    const ids = Array.from(
      new Set(
        lineItemsRef.current
          .filter((item) => item.catalogItemId)
          .map((item) => item.catalogItemId as string),
      ),
    );
    if (ids.length === 0 || !forVendorId) return 0;
    try {
      const params = new URLSearchParams({ vendorId: forVendorId, ids: ids.join(",") });
      if (forTierId) params.set("tierId", forTierId);
      const res = await fetch(`/api/cabinet-catalog/items?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) return 0;
      const byId = new Map<string, CatalogItemSuggestion>(
        (json.items || []).map((it: CatalogItemSuggestion) => [it.id, it]),
      );
      const changedCount = lineItemsRef.current.filter((item) => {
        const match = item.catalogItemId ? byId.get(item.catalogItemId) : null;
        return match ? Number(match.unitPrice) !== Number(item.unitPrice ?? 0) : false;
      }).length;
      setLineItems((prev) =>
        prev.map((item) => {
          if (!item.catalogItemId) return item;
          const match = byId.get(item.catalogItemId);
          if (!match) return item;
          return {
            ...item,
            description: match.description,
            unitPrice: match.unitPrice,
            summaryBucket: match.summaryBucket,
            installationItemId: match.installationItemId,
            catalogImageUrl: match.catalogImageUrl,
          };
        }),
      );
      return changedCount;
    } catch {
      // non-fatal - line items simply keep their last known price/description
      return 0;
    }
  }

  const cabinetsTotal = useMemo(
    () =>
      computeCabinetsTotal(
        lineItems.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice ?? 0 })),
      ),
    [lineItems],
  );

  // Discount dropdown choices come from GMD Parameters (active ones, plus
  // whatever this estimate currently has so an old/deactivated discount still
  // displays). Falls back to the original fixed list until they load.
  const discountSelectOptions = useMemo(() => {
    const configured = gmdParameters.discountOptions || [];
    const base =
      configured.length > 0
        ? configured
            .filter((d) => d.isActive || d.percent === discountPercent)
            .map((d) => ({ value: String(d.percent), label: discountPercentLabel(d.percent, d.label) }))
        : DISCOUNT_PERCENT_OPTIONS.map((pct) => ({
            value: String(pct),
            label: discountPercentLabel(pct),
          }));
    if (!base.some((o) => o.value === String(discountPercent))) {
      base.push({
        value: String(discountPercent),
        label: discountPercentLabel(discountPercent),
      });
    }
    return base;
  }, [gmdParameters.discountOptions, discountPercent]);

  const discountAmount = useMemo(
    () => computeDiscountAmount(cabinetsTotal, discountPercent),
    [cabinetsTotal, discountPercent],
  );

  // Search only hides rows in the list - quantities already entered on
  // hidden rows are kept and still count toward the total.
  const filteredSpecialCustomizationItems = useMemo(() => {
    const q = specialCustomizationSearch.trim().toLowerCase();
    if (!q) return props.specialCustomizationItems;
    return props.specialCustomizationItems.filter((item) =>
      item.name.toLowerCase().includes(q),
    );
  }, [props.specialCustomizationItems, specialCustomizationSearch]);

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
  // surcharge - a percent of that line's own qty*unitPrice, where the
  // percent is the single value currently set on GMD Parameters (round 9 -
  // no longer typed per line). It never touches that line's own total/the
  // Cabinets total, it's a separate amount that rolls into Installation.
  // This is a live preview only - the server re-derives the real number
  // from its own fresh read of GMD Parameters at save time.
  const lineCustomizationSurchargeTotal = useMemo(
    () =>
      computeLineItemsCustomizationSurchargeTotal(
        lineItems.map((item) => ({
          qty: item.qty,
          unitPrice: item.unitPrice ?? 0,
          isCustomization: item.isCustomization,
          customizationValue: gmdParameters.settings.customSurchargePercent,
        })),
      ),
    [lineItems, gmdParameters.settings.customSurchargePercent],
  );

  // Base Installation (round 9) - see cabinetEstimateCalc.ts for the 3 calc
  // modes. A live preview only, same caveat as above.
  const baseInstallationAmount = useMemo(
    () =>
      computeBaseInstallationAmount({
        cabinetsTotal,
        lineItems: lineItems.map((item) => ({
          qty: item.qty,
          unitPrice: item.unitPrice ?? 0,
          installationItemId: item.installationItemId,
        })),
        installationServiceItemPrices: installationServiceItemPricesById(gmdParameters.installationServiceItems),
        calcMode: gmdParameters.settings.installationCalcMode,
        basePercent: gmdParameters.settings.installationBasePercent,
      }),
    [cabinetsTotal, lineItems, gmdParameters.installationServiceItems, gmdParameters.settings.installationCalcMode, gmdParameters.settings.installationBasePercent],
  );

  const selectedInstallationType = useMemo(
    () => gmdParameters.installationTypes.find((t) => t.id === installationTypeId) || null,
    [gmdParameters.installationTypes, installationTypeId],
  );

  // Flat add-on from the Installers Price Table "Microwave" row - see
  // computeMicrowaveInstallationAmount (not scaled by the type multiplier).
  const microwaveInstallationAmount = useMemo(
    () =>
      computeMicrowaveInstallationAmount(
        microwaveInstallation,
        gmdParameters.installationServiceItems,
      ),
    [microwaveInstallation, gmdParameters.installationServiceItems],
  );

  const installationAmount = useMemo(
    () =>
      Math.round(
        (baseInstallationAmount * (selectedInstallationType?.multiplier ?? 1) +
          microwaveInstallationAmount) *
          100,
      ) / 100,
    [baseInstallationAmount, selectedInstallationType, microwaveInstallationAmount],
  );

  // Round 12: Removal - a live preview only, same caveat as Installation
  // above; the server always recomputes this itself from a fresh read of
  // GMD Parameters at save time (see computeRemovalAmount/resolveRemovalType).
  const selectedRemovalType = useMemo(
    () => gmdParameters.removalTypes.find((t) => t.id === removalTypeId) || null,
    [gmdParameters.removalTypes, removalTypeId],
  );

  const removalAmount = useMemo(
    () => computeRemovalAmount(cabinetsTotal, selectedRemovalType?.percent),
    [cabinetsTotal, selectedRemovalType],
  );

  // Sum qty per bucket across catalog-linked line items - this is what
  // actually feeds the Cabinets Summary box and gets saved to the estimate
  // (standardCabinetsCount/etc), the same "compute, don't type" treatment
  // cabinetsTotal already gets. Free-typed lines (no catalogItemId) simply
  // don't contribute to any bucket.
  const cabinetsSummaryCounts = useMemo(() => {
    const counts = { STANDARD: 0, DOUBLE: 0, CUSTOM: 0, MISC: 0 } as Record<
      CabinetSummaryBucket,
      number
    >;
    for (const item of lineItems) {
      if (item.summaryBucket) counts[item.summaryBucket] += item.qty || 0;
    }
    return counts;
  }, [lineItems]);

  // Total piece count across every row (catalog-linked or free-typed) -
  // same "compute, don't type" treatment as the bucket counts above.
  const totalItemsQuantity = useMemo(
    () => lineItems.reduce((sum, item) => sum + (item.qty || 0), 0),
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
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
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
    setVendorId("");
    setPriceTierId("");
    setRemovalTypeId("");
    setProjectType("");
    setVersion("");
    setVersionActual("");
    setIsRemeasure(false);
    setLoadedIsRemeasure(false);
    setOriginalEstimate(null);
    setRemeasureEstimates([]);
    setRemeasureByName("");
    setShowCost(false);
    setSavedSnapshot(null);
    snapshotForId.current = null;
    setRepriceOnOpen(null);
    remeasureBackup.current = null;
    setLineItems(makeBlankRows(MIN_BLANK_ROWS));
    setMicrowaveInstallation(false);
    setDiscountPercent(0);
    setInstallationTypeId(
      gmdParameters.installationTypes.find((t) => t.isActive)?.id ||
        gmdParameters.installationTypes[0]?.id ||
        "",
    );
    setSpecialCustomizationQtyById({});
    setNotes("");
    setMessage(null);
    setError(null);
    router.replace("/cabinet-estimates");
  }

  function buildPayload(creatingRemeasure: boolean) {
    return {
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
      vendorId: vendorId || null,
      priceTierId: priceTierId || null,
      removalTypeId: removalTypeId || null,
      projectType,
      isRemeasure,
      originalEstimateId: creatingRemeasure ? estimateId : null,
      standardCabinetsCount: cabinetsSummaryCounts.STANDARD,
      doubleCabinetsCount: cabinetsSummaryCounts.DOUBLE,
      customCabinetsCount: cabinetsSummaryCounts.CUSTOM,
      miscCabinetsCount: cabinetsSummaryCounts.MISC,
      itemsQuantity: totalItemsQuantity,
      microwaveInstallation,
      discountPercent,
      installationTypeId: installationTypeId || null,
      notes,
      lineItems: lineItems.map((item) => ({
        qty: item.qty,
        code: item.code,
        description: item.description,
        isCustomization: item.isCustomization,
        note: item.note,
        unitPrice: item.unitPrice,
        catalogItemId: item.catalogItemId,
        summaryBucket: item.summaryBucket,
        installationItemId: item.installationItemId,
      })),
      specialCustomizationLines: props.specialCustomizationItems
        .map((item) => ({ itemId: item.id, qty: specialCustomizationQtyById[item.id] || 0 }))
        .filter((line) => line.qty > 0),
    };
  }

  const currentSnapshot = JSON.stringify(buildPayload(isRemeasure && !loadedIsRemeasure));
  useEffect(() => {
    if (loading || !estimateId) return;
    if (snapshotForId.current === estimateId) return;
    snapshotForId.current = estimateId;
    setSavedSnapshot(currentSnapshot);
  }, [loading, estimateId, currentSnapshot]);
  const isDirty =
    Boolean(estimateId) && savedSnapshot !== null && currentSnapshot !== savedSnapshot;

  // Past the price lock (older than PRICE_LOCK_DAYS): show the current price
  // list's prices. Runs after the loaded estimate is snapshotted, so the
  // refreshed prices count as unsaved changes.
  useEffect(() => {
    if (!repriceOnOpen || loading || !estimateId) return;
    if (snapshotForId.current !== estimateId) return;
    const target = repriceOnOpen;
    setRepriceOnOpen(null);
    (async () => {
      const changedCount = await repriceCatalogItems(target.vendorId, target.tierId);
      if (changedCount > 0) {
        setMessage(
          `This estimate is over ${PRICE_LOCK_DAYS} days old, so ${changedCount} line price${
            changedCount === 1 ? " was" : "s were"
          } refreshed from the current price list. Save to keep the new prices.`,
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repriceOnOpen, loading, estimateId]);

  // Remeasure always starts from the current price list; unticking restores
  // the prices the estimate had.
  function handleRemeasureToggle(checked: boolean) {
    setIsRemeasure(checked);
    if (checked) {
      remeasureBackup.current = lineItemsRef.current.map((item) => ({ ...item }));
      repriceCatalogItems(vendorId, priceTierId).then((changedCount) => {
        if (changedCount > 0) {
          setMessage(
            `Remeasure uses the current price list: ${changedCount} line price${
              changedCount === 1 ? "" : "s"
            } updated.`,
          );
        }
      });
    } else if (remeasureBackup.current) {
      setLineItems(remeasureBackup.current);
      remeasureBackup.current = null;
    }
  }

  useEffect(() => {
    if (!showCost || costData || !props.canViewCost) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cabinet-estimates/cost-view");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load cost data");
        if (cancelled) return;
        setCostData(json);
        setCostInstallerId((prev) => prev || json.installers?.[0]?.id || "");
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to load cost data");
        setShowCost(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showCost, costData, props.canViewCost]);

  async function handleSave(): Promise<string | null> {
    if (showCost) {
      setMessage(null);
      setError("Saving is disabled in the Preco de Custo view. Turn it off to save.");
      return null;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    // Ticking "Remeasure PK List" on an already-saved estimate creates a NEW
    // estimate numbered <original>R instead of changing the original.
    const creatingRemeasure = isRemeasure && !loadedIsRemeasure;
    try {
      if (creatingRemeasure && !estimateId) {
        throw new Error("Open the saved estimate you want to remeasure first.");
      }
      const payload = buildPayload(creatingRemeasure);

      const updatingInPlace = Boolean(estimateId) && !creatingRemeasure;
      const res = await fetch(
        updatingInPlace
          ? `/api/cabinet-estimates/${estimateId}`
          : "/api/cabinet-estimates",
        {
          method: updatingInPlace ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save estimate");

      if (json.unchanged) {
        setMessage("No changes to save - the estimate # stays the same.");
        setSavedSnapshot(JSON.stringify(payload));
        return estimateId;
      }

      setEstimateId(json.id);
      setEstimateNumber(json.estimateNumber || estimateNumber);
      if (creatingRemeasure) {
        setMessage(`Remeasure estimate #${json.estimateNumber} created.`);
      } else if (json.renumbered) {
        setMessage(
          `Changes saved as new estimate #${json.estimateNumber}. The previous estimate #${json.previousEstimateNumber} was archived.`,
        );
      } else {
        setMessage(estimateId ? "Estimate updated." : "Estimate saved.");
      }
      setSavedSnapshot(JSON.stringify(payload));
      snapshotForId.current = json.id;
      router.replace(`/cabinet-estimates?estimateId=${json.id}`);
      return json.id as string;
    } catch (err: any) {
      setError(err?.message || "Failed to save estimate");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function openPrintWindow(kind: "normal" | "pk" | "cost", id: string) {
    const params = new URLSearchParams({ autoprint: "1" });
    if (kind === "pk") params.set("pk", "1");
    if (kind === "cost") {
      params.set("cost", "1");
      if (costInstallerId) params.set("installer", costInstallerId);
    }
    const win = window.open(`/cabinet-estimates/print/${id}?${params.toString()}`, "_blank");
    if (!win) setError("The print page was blocked by the browser. Allow pop-ups and try again.");
  }

  function handlePrint(pkList = false) {
    if (!estimateId) {
      setError("Save the estimate before printing.");
      return;
    }
    const kind = pkList ? "pk" : showCost && props.canViewCost ? "cost" : "normal";
    // The print page shows the SAVED estimate, so ask what to do with edits.
    if (isDirty) {
      setPrintPrompt(kind);
      return;
    }
    openPrintWindow(kind, estimateId);
  }

  async function handleSaveAndPrint() {
    const kind = printPrompt;
    if (!kind) return;
    setPrintPrompt(null);
    const id = await handleSave();
    if (id) openPrintWindow(kind, id);
  }

  // Version shown in the header: admins see the true version, everyone else
  // the public one. A saved estimate shows the version it was saved under.
  const programVersion = gmdParameters.programVersion;
  const viewerIsAdmin = Boolean(programVersion?.actual);
  const displayedVersion = estimateId
    ? viewerIsAdmin
      ? versionActual || version
      : version
    : (viewerIsAdmin ? programVersion?.actual : programVersion?.public) || "";

  // Vendor cost ("Preco de Custo"): estimate prices are cost x the vendor
  // company's sales factor, so cost = amount / factor.
  const vendorFactor = vendors.find((v) => v.id === vendorId)?.factor;
  const toCost = (amount: number) => computeCabinetsCost(amount, vendorFactor);

  // Preco de Custo summary: Cabinets (cost) + Tax = Cabinets Subtotal, plus the
  // chosen installer's cost, = Total.
  const costInstallerResult = computeInstallerCost({
    lines: lineItems
      .filter((item) => !isEmptyLineItem(item))
      .map((item) => ({ qty: item.qty, installationItemId: item.installationItemId })),
    costsByItemId: costData ? costsByItemIdForInstaller(costData.costs, costInstallerId) : {},
    microwave: microwaveInstallation,
    microwaveItemId: findMicrowaveServiceItem(gmdParameters.installationServiceItems)?.id,
  });
  const costSummary = computeCostSummary({
    cabinetsCost: toCost(cabinetsTotal),
    taxPercent: costData?.taxPercent ?? gmdParameters.settings.costTaxPercent ?? 0,
    installationCost: costInstallerResult.amount,
  });

  // Dropdown options are listed alphabetically.
  const collator = useMemo(
    () => new Intl.Collator("en", { numeric: true, sensitivity: "base" }),
    [],
  );
  const sortedVendors = useMemo(
    () => [...vendors].sort((a, b) => collator.compare(a.displayName, b.displayName)),
    [vendors, collator],
  );
  const sortedPriceTiers = useMemo(
    () => [...priceTiers].sort((a, b) => collator.compare(a.name, b.name)),
    [priceTiers, collator],
  );
  const sortedRemovalTypes = useMemo(
    () => [...gmdParameters.removalTypes].sort((a, b) => collator.compare(a.name, b.name)),
    [gmdParameters.removalTypes, collator],
  );
  const sortedProjectTypes = useMemo(
    () => [...gmdParameters.projectTypes].sort((a, b) => collator.compare(a.name, b.name)),
    [gmdParameters.projectTypes, collator],
  );

  return (
    <div className="mx-auto max-w-[100rem] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cabinet Estimate
          </h1>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {estimateNumber
              ? `${loadedIsRemeasure ? "Remeasure Estimate" : "Estimate"} #${estimateNumber}`
              : "New estimate - estimate # is assigned on save."}
          </p>
          {((loadedIsRemeasure && originalEstimate) || remeasureEstimates.length > 0) && (
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {loadedIsRemeasure ? "Original Estimate#:" : "Remeasure Estimate#:"}{" "}
              {loadedIsRemeasure && originalEstimate ? (
                <Link
                  href={`/cabinet-estimates?estimateId=${originalEstimate.id}`}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {originalEstimate.estimateNumber}
                </Link>
              ) : (
                remeasureEstimates.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 ? ", " : ""}
                    <Link
                      href={`/cabinet-estimates?estimateId=${r.id}`}
                      className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {r.estimateNumber}
                    </Link>
                  </span>
                ))
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RotateCcw className="h-4 w-4" /> New
          </button>
          <CopyQBooksButton
            estimateNumber={estimateNumber}
            customerName={customerName}
            jobName={jobName}
            salesperson={salesRep}
            brand={brand}
            color={groupColor}
            onResult={(ok) => {
              if (ok) {
                setError(null);
                setMessage("Copied the estimate details for QuickBooks.");
              } else {
                setMessage(null);
                setError("Couldn't copy to the clipboard.");
              }
            }}
          />
          {props.canViewCost && (
          <button
            type="button"
            onClick={() => setShowCost((v) => !v)}
            aria-pressed={showCost}
            title="Show every price at the vendor's actual cost"
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
              showCost
                ? "border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-200"
                : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <DollarSign className="h-4 w-4" /> Preco de Custo
          </button>
          )}
          <button
            type="button"
            onClick={() => handlePrint(true)}
            disabled={!estimateId}
            title="Print the estimate without prices"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ClipboardList className="h-4 w-4" /> PK List
          </button>
          <button
            type="button"
            onClick={() => handlePrint(false)}
            disabled={!estimateId}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || showCost}
            title={showCost ? "Saving is disabled in the Preco de Custo view" : undefined}
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

      {printPrompt &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPrintPrompt(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
          >
            <div
              className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Save changes before printing?
              </h2>
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                {showCost
                  ? "You have unsaved changes. The printed page shows the last saved version, and saving is turned off in the Preco de Custo view. Turn it off to save first."
                  : "You have unsaved changes. The printed page shows the last saved version, so it would be missing your latest edits."}
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrintPrompt(null)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const kind = printPrompt;
                    setPrintPrompt(null);
                    if (kind && estimateId) openPrintWindow(kind, estimateId);
                  }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {showCost ? "Print anyway" : "Print without saving"}
                </button>
                {!showCost && (
                  <button
                    type="button"
                    onClick={handleSaveAndPrint}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save &amp; print
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Loading estimate...
        </div>
      ) : (
        <>
          {imagePreview &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
                onClick={() => setImagePreview(null)}
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {imagePreview.code}
                      </div>
                      {imagePreview.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {imagePreview.description}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      aria-label="Close"
                      className="rounded p-1 text-xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="flex items-center justify-center overflow-auto bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview.url}
                      alt={imagePreview.code}
                      className="max-h-[75vh] w-auto max-w-full object-contain"
                    />
                  </div>
                </div>
              </div>,
              document.body,
            )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div ref={leftColumnRef} className="flex min-w-0 flex-1 flex-col gap-3">
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
                <div className="font-mono text-[15px] font-bold tracking-wide text-gray-800 dark:text-gray-200">
                  {formatEstimateReferenceNumber(
                    computeCabinetsCost(
                      cabinetsTotal,
                      vendors.find((v) => v.id === vendorId)?.factor,
                    ),
                    referenceRandomDigits,
                  )}
                </div>
              </div>

              <div className="divide-y divide-gray-300 border-b border-gray-300 dark:divide-gray-600 dark:border-gray-600 lg:border-b-0 lg:border-r">
                <div
                  ref={clientBoxRef}
                  className="relative grid grid-cols-[130px_1fr] divide-x divide-gray-300 dark:divide-gray-600"
                >
                  <div className="flex items-center bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
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
                      <div className="absolute left-0 top-full z-50 max-h-80 w-[26rem] max-w-[90vw] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800">
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
                              className="block w-full px-3 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-gray-700"
                            >
                              <div className="truncate font-medium text-gray-900 dark:text-gray-100">
                                {result.displayName}
                              </div>
                              {result.customerAddress && (
                                <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                  {result.customerAddress}
                                </div>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[130px_1fr] divide-x divide-gray-300 dark:divide-gray-600">
                  <div className="flex items-center bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Job Name
                  </div>
                  {clientJobs.length > 0 ? (
                    <RoundedSelect
                      value={selectedJobId}
                      onChange={selectJob}
                      placeholder="Select a job/deal..."
                      options={[
                        { value: "", label: "Select a job/deal..." },
                        ...clientJobs.map((job) => ({
                          value: job.id,
                          label: job.dealName || job.id,
                        })),
                      ]}
                      menuMinWidth={260}
                    />
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

                <HeaderRow label="Brand" highlight={!vendorId}>
                  <RoundedSelect
                    value={vendorId}
                    onChange={(nextVendorId) => {
                                            const vendor = vendors.find((v) => v.id === nextVendorId);
                      setVendorId(nextVendorId);
                      setBrand(vendor?.displayName || "");
                      setPriceTierId("");
                      setGroupColor("");
                      // Switching brands means switching catalogs entirely -
                      // a code from the old vendor almost never means the
                      // same cabinet (or exists at all) under the new one,
                      // so clear every catalog-linked row rather than risk
                      // showing a price/description that doesn't match.
                      setLineItems((prev) =>
                        prev.map((item) =>
                          item.catalogItemId
                            ? {
                                ...item,
                                catalogItemId: null,
                                summaryBucket: null,
                                installationItemId: null,
                                description: "",
                                unitPrice: 0,
                              }
                            : item,
                        ),
                      );
                    }}
                    placeholder={brand || "-- Select brand --"}
                    options={[
                      { value: "", label: brand || "-- Select brand --" },
                      ...sortedVendors.map((v) => ({ value: v.id, label: v.displayName })),
                    ]}
                  />
                </HeaderRow>

                <HeaderRow label="Group / Color" highlight={Boolean(vendorId) && !priceTierId}>
                  <RoundedSelect
                    value={priceTierId}
                    onChange={(nextTierId) => {
                                            const tier = priceTiers.find((t) => t.id === nextTierId);
                      setPriceTierId(nextTierId);
                      setGroupColor(tier?.name || "");
                      // Swapping the color/tier keeps the same catalog items
                      // but their price (and possibly description) can be
                      // different for the new tier - refresh every already
                      // catalog-linked row instantly rather than leaving it
                      // showing the old tier's price.
                      repriceCatalogItems(vendorId, nextTierId);
                    }}
                    disabled={!vendorId}
                    placeholder={groupColor || (vendorId ? "-- Select group/color --" : "Select a brand first")}
                    options={[
                      {
                        value: "",
                        label: groupColor || (vendorId ? "-- Select group/color --" : "Select a brand first"),
                      },
                      ...sortedPriceTiers.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                  />
                </HeaderRow>

                <HeaderRow label="Removal">
                  <RoundedSelect
                    value={removalTypeId}
                    onChange={setRemovalTypeId}
                    options={[
                      { value: "", label: "-- None --" },
                      ...sortedRemovalTypes
                        .filter((t) => t.isActive || t.id === removalTypeId)
                        .map((t) => ({ value: t.id, label: t.name })),
                    ]}
                  />
                </HeaderRow>

                <HeaderRow label="Project Type">
                  <RoundedSelect
                    value={projectType}
                    onChange={setProjectType}
                    options={[
                      { value: "", label: "-- None --" },
                      ...sortedProjectTypes
                        .filter((t) => t.isActive || t.name === projectType)
                        .map((t) => ({ value: t.name, label: t.name })),
                      // A saved estimate's projectType may hold a value from
                      // before this dropdown existed (free text) or one that
                      // no longer matches any configured option - keep it
                      // selectable so it isn't silently blanked out on load.
                      ...(projectType &&
                      !gmdParameters.projectTypes.some((t) => t.name === projectType)
                        ? [{ value: projectType, label: projectType }]
                        : []),
                    ]}
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
                  <div
                    className="mt-0.5 text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                    title={
                      viewerIsAdmin && version && versionActual && version !== versionActual
                        ? `Public version: ${version}`
                        : "Set automatically from GMD Parameters > Version Updates"
                    }
                  >
                    {displayedVersion || "-"}
                  </div>
                </MetaBox>
                <div className="flex flex-col gap-0.5">
                <label
                  className={`flex items-center gap-1.5 rounded-md border border-gray-300 px-1.5 py-1 text-[11px] font-semibold text-gray-900 dark:border-gray-600 dark:text-gray-100 ${
                    !estimateId || loadedIsRemeasure ? "opacity-60" : "cursor-pointer"
                  }`}
                  title={
                    loadedIsRemeasure
                      ? "This estimate is a remeasure"
                      : estimateId
                      ? "Saving with this checked creates a new estimate numbered <original>R"
                      : "Open a saved estimate to create its remeasure"
                  }
                >
                  <input
                    type="checkbox"
                    checked={isRemeasure}
                    disabled={!estimateId || loadedIsRemeasure}
                    onChange={(e) => handleRemeasureToggle(e.target.checked)}
                  />
                  Remeasure PK List
                </label>
                {isRemeasure && (
                  <div className="px-1 text-[10px] text-gray-600 dark:text-gray-400">
                    By: {loadedIsRemeasure ? remeasureByName || "-" : props.currentUserName}
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          {showCost && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Preco de Custo (view only): prices show the vendor&apos;s actual cost and the summary
              shows cost-side totals with the selected installer&apos;s cost. Saving is turned off
              in this view; you can still print it.
            </div>
          )}

          {/* Body - item table */}
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 text-xs uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    <th className="w-14 border border-gray-300 px-2 py-1.5 text-center dark:border-gray-600">
                      Qty
                    </th>
                    <th className="w-24 border border-gray-300 px-2 py-1.5 text-center dark:border-gray-600">
                      Code
                    </th>
                    <th className="w-72 border border-gray-300 px-2 py-1.5 text-left dark:border-gray-600">
                      Description
                    </th>
                    <th className="w-20 border border-gray-300 px-2 py-1.5 text-center dark:border-gray-600">
                      Custom
                    </th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left dark:border-gray-600">
                      Note
                    </th>
                    <th className="w-28 border border-gray-300 px-2 py-1.5 text-center dark:border-gray-600">
                      P.Unit
                    </th>
                    <th className="w-28 border border-gray-300 px-2 py-1.5 text-center dark:border-gray-600">
                      P.Total
                    </th>
                    <th className="w-10 border border-gray-300 px-1 py-2 dark:border-gray-600" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => {
                    // Catalog-linked, but no price exists for the current
                    // Brand/Group-Color - render N/A instead of a $0.00
                    // that would look like a genuine free item.
                    const hasMissingPrice = Boolean(item.catalogItemId) && item.unitPrice == null;
                    return (
                    <tr key={item.key} className="border-b border-gray-200 dark:border-gray-700">
                      <td
                        className={`border border-gray-200 p-1 text-center align-middle dark:border-gray-700 ${
                          item.code && item.qty === 0 ? "bg-red-50 dark:bg-red-950/30" : ""
                        }`}
                      >
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
                          title={item.code && item.qty === 0 ? "Quantity is missing for this item" : undefined}
                          className="w-full bg-transparent px-1.5 py-0.5 text-center text-xs text-gray-900 outline-none dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="relative border border-gray-200 p-1 text-center align-middle dark:border-gray-700">
                        <input
                          ref={(el) => registerCellRef(index, "code", el)}
                          value={item.code}
                          onChange={(e) => {
                            updateItem(index, {
                              code: e.target.value,
                              catalogItemId: null,
                              summaryBucket: null,
                              installationItemId: null,
                              description: "",
                              unitPrice: 0,
                            });
                            setCodeQuery({ index, text: e.target.value });
                            const rect = e.target.getBoundingClientRect();
                            setCodeDropdownRect({
                              top: rect.bottom,
                              left: rect.left,
                              width: rect.width,
                            });
                          }}
                          onFocus={(e) => {
                            setCodeQuery({ index, text: item.code });
                            const rect = e.target.getBoundingClientRect();
                            setCodeDropdownRect({
                              top: rect.bottom,
                              left: rect.left,
                              width: rect.width,
                            });
                          }}
                          onBlur={() =>
                            setTimeout(
                              () => setCodeQuery((q) => (q?.index === index ? null : q)),
                              150,
                            )
                          }
                          onKeyDown={(e) => handleAdvanceRowKeyDown(e, index, "code")}
                          autoComplete="off"
                          title={
                            !vendorId
                              ? "Select a Brand above to search the catalog"
                              : !priceTierId
                                ? "Select a Group/Color above to see prices"
                                : undefined
                          }
                          className="w-full bg-transparent px-1.5 py-0.5 text-center text-xs text-gray-900 outline-none dark:text-gray-100"
                        />
                        {codeQuery?.index === index &&
                          codeSuggestions.length > 0 &&
                          codeDropdownRect &&
                          typeof document !== "undefined" &&
                          createPortal(
                            <div
                              ref={codeDropdownRef}
                              style={{
                                position: "fixed",
                                top: codeDropdownRect.top,
                                left: Math.min(
                                  codeDropdownRect.left,
                                  window.innerWidth - 328,
                                ),
                                width: Math.max(codeDropdownRect.width, 320),
                              }}
                              className="z-50 max-h-64 overflow-y-auto rounded border border-gray-300 bg-white text-xs shadow-lg dark:border-gray-600 dark:bg-gray-800"
                            >
                              {codeSuggestions.map((s) => (
                                <button
                                  type="button"
                                  key={s.id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectCatalogItem(index, s)}
                                  className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-blue-50 dark:hover:bg-gray-700"
                                >
                                  {s.catalogImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={s.catalogImageUrl}
                                      alt=""
                                      className="h-8 w-8 shrink-0 rounded border border-gray-200 object-contain dark:border-gray-600"
                                    />
                                  ) : null}
                                  <span className="min-w-0">
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                      {s.code}
                                    </span>{" "}
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {s.description}
                                    </span>
                                  </span>
                                </button>
                              ))}
                            </div>,
                            document.body,
                          )}
                      </td>
                      <td className="border border-gray-200 p-1 align-top dark:border-gray-700">
                        <div className="flex items-start gap-1.5">
                          {item.catalogImageUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setImagePreview({
                                  url: item.catalogImageUrl as string,
                                  code: item.code,
                                  description: item.description,
                                })
                              }
                              title="View catalog image"
                              className="mt-0.5 shrink-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.catalogImageUrl}
                                alt=""
                                className="h-8 w-8 rounded border border-gray-200 object-contain hover:border-blue-400 dark:border-gray-600"
                              />
                            </button>
                          ) : null}
                          <div
                            className="min-h-[1.5rem] min-w-0 whitespace-pre-wrap break-words px-1.5 py-0.5 text-xs text-gray-900 dark:text-gray-100"
                            title={item.description || undefined}
                          >
                            {item.description || (
                              <span className="text-gray-400 dark:text-gray-500">
                                {item.code ? "No catalog match" : "Pick a code"}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="border border-gray-200 p-1 text-center align-middle dark:border-gray-700">
                        <label
                          className="flex w-full cursor-pointer items-center justify-center py-0.5"
                          title="Adds the GMD Parameters Custom surcharge % to Installation"
                        >
                          <input
                            type="checkbox"
                            checked={item.isCustomization}
                            onChange={(e) =>
                              updateItem(index, { isCustomization: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                          />
                        </label>
                      </td>
                      <td className="border border-gray-200 p-1 align-top dark:border-gray-700">
                        <textarea
                          ref={(el) => {
                            registerCellRef(index, "note", el);
                            autoResizeTextarea(el);
                          }}
                          value={item.note}
                          onChange={(e) => {
                            updateItem(index, { note: e.target.value });
                            autoResizeTextarea(e.target);
                          }}
                          onKeyDown={(e) => handleAdvanceRowKeyDown(e, index, "note")}
                          rows={1}
                          className="block w-full resize-none overflow-hidden bg-transparent px-1.5 py-0.5 text-xs text-gray-900 outline-none dark:text-gray-100"
                        />
                      </td>
                      <td
                        className={`border border-gray-200 p-1 text-center align-middle dark:border-gray-700 ${
                          (item.code && item.qty === 0) || hasMissingPrice ? "bg-red-50 dark:bg-red-950/30" : ""
                        }`}
                      >
                        <div
                          className={`px-1.5 py-0.5 text-xs ${hasMissingPrice ? "font-medium text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}
                          title={
                            hasMissingPrice
                              ? "No price found for this item at the selected Brand/Group-Color - pick a different Group/Color, or ask an admin to add one via Import Price List"
                              : item.code && item.qty === 0
                              ? "Quantity is missing for this item"
                              : "Set automatically from the selected catalog code, brand and group/color - not editable"
                          }
                        >
                          {hasMissingPrice
                            ? "N/A"
                            : formatCurrency(showCost ? toCost(item.unitPrice ?? 0) : item.unitPrice)}
                        </div>
                      </td>
                      <td className="border border-gray-200 p-1 text-center align-middle text-xs font-medium text-gray-900 dark:border-gray-700 dark:text-gray-100">
                        {hasMissingPrice ? (
                          <span className="text-red-600 dark:text-red-400">N/A</span>
                        ) : (
                          formatCurrency(
                            showCost
                              ? toCost(computeLineItemTotal(item.qty, item.unitPrice ?? 0))
                              : computeLineItemTotal(item.qty, item.unitPrice ?? 0),
                          )
                        )}
                      </td>
                      <td className="border border-gray-200 p-1 align-top text-center dark:border-gray-700">
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
                    );
                  })}
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
                  <span
                    className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                    title="Auto-computed from catalog-linked item rows"
                  >
                    {cabinetsSummaryCounts.STANDARD}
                  </span>
                </CategoryRow>
                <CategoryRow label="Double Cabinets">
                  <span
                    className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                    title="Auto-computed from catalog-linked item rows"
                  >
                    {cabinetsSummaryCounts.DOUBLE}
                  </span>
                </CategoryRow>
                <CategoryRow label="Custom Cabinets">
                  <span
                    className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                    title="Auto-computed from catalog-linked item rows"
                  >
                    {cabinetsSummaryCounts.CUSTOM}
                  </span>
                </CategoryRow>
                <CategoryRow label="Miscellaneous">
                  <span
                    className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                    title="Auto-computed from catalog-linked item rows"
                  >
                    {cabinetsSummaryCounts.MISC}
                  </span>
                </CategoryRow>
                <CategoryRow label="Quantity of Items">
                  <span
                    className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                    title="Auto-computed: sum of every row's quantity"
                  >
                    {totalItemsQuantity}
                  </span>
                </CategoryRow>
                <CategoryRow label="Microwave Installation">
                  <RoundedSelect
                    variant="boxed"
                    className="w-20"
                    menuMinWidth={80}
                    value={microwaveInstallation ? "yes" : "no"}
                    onChange={(v) => setMicrowaveInstallation(v === "yes")}
                    options={[
                      { value: "no", label: "No" },
                      { value: "yes", label: "Yes" },
                    ]}
                  />
                </CategoryRow>
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
              <div className="bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Total Summary
              </div>
              <div className="flex flex-1 flex-col divide-y divide-gray-200 text-xs dark:divide-gray-700">
                {showCost && props.canViewCost ? (
                  <>
                    <TotalsRow label="Cabinets (cost)">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(costSummary.cabinetsCost)}
                      </span>
                    </TotalsRow>
                    <TotalsRow
                      label={`Tax${
                        (costData?.taxPercent ?? 0) > 0 ? ` (${costData?.taxPercent}%)` : ""
                      }`}
                      className="bg-red-50 dark:bg-red-950/30"
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(costSummary.tax)}
                      </span>
                    </TotalsRow>
                    <TotalsRow label="Cabinets Subtotal" className="bg-amber-50 dark:bg-amber-950/30">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(costSummary.cabinetsSubtotal)}
                      </span>
                    </TotalsRow>
                    <TotalsRow label="Installation (cost)" className="bg-green-50 dark:bg-green-950/30">
                      <div className="flex items-center gap-1.5">
                        <RoundedSelect
                          variant="boxed"
                          className="w-28"
                          menuMinWidth={140}
                          value={costInstallerId}
                          onChange={setCostInstallerId}
                          placeholder={costData ? "No installers" : "Loading..."}
                          ariaLabel="Installer"
                          options={(costData?.installers ?? []).map((i) => ({
                            value: i.id,
                            label: i.name,
                          }))}
                        />
                        <span
                          className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                          title={
                            costInstallerResult.missingCount > 0
                              ? `${costInstallerResult.missingCount} line(s) have no cost for this installer and add $0`
                              : "Selected installer's cost from the Installers Price Table"
                          }
                        >
                          {formatCurrency(costSummary.installationCost)}
                          {costInstallerResult.missingCount > 0 ? "*" : ""}
                        </span>
                      </div>
                    </TotalsRow>
                    <div className="mt-auto flex items-center justify-between bg-blue-600 px-2.5 py-1.5 text-white">
                      <span className="text-xs font-semibold uppercase tracking-wide">Total</span>
                      <span className="text-sm font-bold">{formatCurrency(costSummary.total)}</span>
                    </div>
                  </>
                ) : (
                  <>
                <TotalsRow label="Cabinets">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(cabinetsTotal)}
                  </span>
                </TotalsRow>
                <TotalsRow label="Discount" className="bg-red-50 dark:bg-red-950/30">
                  <div className="flex items-center gap-1.5">
                    <RoundedSelect
                      variant="boxed"
                      className="w-24"
                      menuMinWidth={110}
                      value={String(discountPercent)}
                      onChange={(v) => setDiscountPercent(Number(v) || 0)}
                      options={discountSelectOptions}
                    />
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
                  <span
                    className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                    title="Computed from the selected Removal Type's percent x the Cabinets total (before discounts) - not editable. Pick a Removal Type in the header."
                  >
                    {formatCurrency(removalAmount)}
                  </span>
                </TotalsRow>
                <TotalsRow label="Installation" className="bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-center gap-1.5">
                    <InfoPopover
                      heading="Installation types"
                      ariaLabel="Explain the installation types"
                      emptyText="No installation types yet."
                      items={gmdParameters.installationTypes
                        .filter((t) => t.isActive)
                        .map((t) => ({ title: t.name, text: t.description || "" }))}
                    />
                    <RoundedSelect
                      variant="boxed"
                      className="w-24"
                      menuMinWidth={110}
                      value={installationTypeId}
                      onChange={setInstallationTypeId}
                      placeholder="Loading..."
                      options={gmdParameters.installationTypes
                        .filter((t) => t.isActive || t.id === installationTypeId)
                        .map((t) => ({ value: t.id, label: t.name }))}
                    />
                    <span
                      className="text-[11px] font-semibold text-gray-900 dark:text-gray-100"
                      title="Computed from GMD Parameters, plus Special Customization and per-item Custom surcharges - not editable"
                    >
                      {formatCurrency(installationTotal)}
                    </span>
                  </div>
                </TotalsRow>
                <div className="mt-auto flex items-center justify-between bg-blue-600 px-2.5 py-1.5 text-white">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total</span>
                  <span className="text-sm font-bold">{formatCurrency(total)}</span>
                </div>
                  </>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Special Customization - admin-managed catalog of customization
              types (see GMD Parameters > Cabinet Estimates). Runs alongside
              the header/table/footer, starting at the top of the form, per
              Diego's request; the user enters a qty per type and the $
              contribution rolls into the "Customization" row in Total
              Summary above. Its height is synced (via leftColumnHeight,
              measured off the left column with a ResizeObserver above) to
              line up exactly with the bottom of the Notes/Cabinets Summary/
              Total Summary row, growing automatically as item rows are
              added - rather than either leaving empty space below a short
              item list or running on past the footer when the item list is
              long, which is what a plain height:auto sidebar did before. */}
          <div
            className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-300 bg-white lg:w-56 dark:border-gray-600 dark:bg-gray-800"
            style={isDesktopLayout && leftColumnHeight ? { height: leftColumnHeight } : undefined}
          >
            <div className="flex-shrink-0 bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Special Customization
            </div>
            {props.specialCustomizationItems.length === 0 ? (
              <div className="p-3 text-xs text-gray-500 dark:text-gray-400">
                No customization types configured yet - add them under
                GMD Parameters &gt; Cabinet Estimates.
              </div>
            ) : (
              <>
              <div className="flex-shrink-0 border-b border-gray-200 p-1.5 dark:border-gray-700">
                <input
                  type="search"
                  value={specialCustomizationSearch}
                  onChange={(e) => setSpecialCustomizationSearch(e.target.value)}
                  placeholder="Search customizations..."
                  aria-label="Search special customizations"
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="min-h-0 flex-1 divide-y divide-gray-200 overflow-y-auto text-xs dark:divide-gray-700">
                {filteredSpecialCustomizationItems.length === 0 && (
                  <div className="p-3 text-gray-500 dark:text-gray-400">
                    No customizations match your search.
                  </div>
                )}
                {filteredSpecialCustomizationItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1"
                  >
                    <span className="break-words pr-1 text-gray-700 dark:text-gray-300">
                      {item.name}
                    </span>
                    <NumberField
                      value={specialCustomizationQtyById[item.id] || 0}
                      onChange={(value) => setSpecialCustomizationQty(item.id, value)}
                      step="1"
                      widthClassName="w-14"
                      blankWhenZero
                      centered
                    />
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}

function HeaderRow({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[130px_1fr] divide-x divide-gray-300 dark:divide-gray-600 ${
        highlight ? "bg-red-50 dark:bg-red-950/30" : ""
      }`}
    >
      <div
        className={`flex items-center px-2 py-0.5 text-[11px] font-semibold text-white ${
          highlight ? "bg-red-600" : "bg-blue-600"
        }`}
        title={highlight ? "Select this to search the catalog and pull real prices" : undefined}
      >
        {label}
        {highlight ? " *" : ""}
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
  centered = false,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: string;
  className?: string;
  widthClassName?: string;
  title?: string;
  blankWhenZero?: boolean;
  centered?: boolean;
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
      className={`${widthClassName} rounded border border-gray-300 bg-white px-1.5 py-0.5 ${centered ? "text-center" : "text-right"} text-[11px] text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className || ""}`}
    />
  );
}
