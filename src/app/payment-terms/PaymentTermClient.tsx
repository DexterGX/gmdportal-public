"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Printer, Save, Trash2, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Invoice = {
  id: string;
  num: string;
  amount: string;
  type: InvoiceType;
};

type InvoiceType = "cabinet" | "countertop";

type LineItemDef = {
  key: string;
  label: string;
  defaultPct: number;
  accent?: boolean;
};

type LineItemState = {
  amount: string;
  depositPct: number;
  noInstallation?: boolean;
};

type SinkSelection = "no-sink" | "gmd-sink" | "client-sink";
type GmdSinkType = "fabricated" | "kitchen-bathroom";
type FabricatedSinkStyle =
  | "slanted-mitered"
  | "slanted-undermount"
  | "rectangular-mitered"
  | "rectangular-undermount";
type EdgeThickness = "2cm" | "3cm" | "2cm-build-up" | "3cm-build-up";
type EdgeProfile =
  | "flat-polished"
  | "beveled-1-4"
  | "beveled-1-2"
  | "beveled-3-4"
  | "half-bullnose"
  | "full-bullnose"
  | "mitered"
  | "waterfall"
  | "ogee"
  | "custom";

type CountertopAgreementSpec = {
  id: string;
  title: string;
  sinkSelection: SinkSelection;
  gmdSinkType: GmdSinkType;
  fabricatedSinkStyle: FabricatedSinkStyle;
  kitchenBathroomBrand: string;
  kitchenBathroomModel: string;
  kitchenBathroomColor: string;
  edgeThickness: EdgeThickness;
  edgeProfile: EdgeProfile;
  customEdgeProfile?: string;
};

type SinkCatalogItem = {
  brandName: string;
  model: string;
};

type AgreementFormTemplateLite = {
  key: string;
  title: string;
  isActive: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CABINET_LINE_DEFS: LineItemDef[] = [
  { key: "cab_removal", label: "Removal", defaultPct: 50 },
  { key: "cab_installation", label: "Installation", defaultPct: 50 },
  { key: "cab_others", label: "Others", defaultPct: 50 },
  { key: "cab_cabinet", label: "Cabinet", defaultPct: 70, accent: true },
];

const COUNTERTOP_LINE_DEFS: LineItemDef[] = [
  { key: "ct_slab", label: "Slab", defaultPct: 100, accent: true },
  { key: "ct_labor", label: "Labor", defaultPct: 50 },
  { key: "ct_tile", label: "Tile", defaultPct: 50 },
  { key: "ct_reconection", label: "Reconection", defaultPct: 50 },
  { key: "ct_misc", label: "Miscellaneous", defaultPct: 50 },
];

const SECTION_META: Record<
  InvoiceType,
  { label: string; headerCls: string; rowCls: string; subCls: string }
> = {
  cabinet: {
    label: "Cabinet",
    headerCls: "bg-blue-700 text-white",
    rowCls: "bg-blue-50/60 dark:bg-blue-900/10",
    subCls: "bg-blue-100/80 dark:bg-blue-900/20 font-semibold",
  },
  countertop: {
    label: "Countertop",
    headerCls: "bg-teal-700 text-white",
    rowCls: "bg-teal-50/60 dark:bg-teal-900/10",
    subCls: "bg-teal-100/80 dark:bg-teal-900/20 font-semibold",
  },
};

const MAX_INVOICES = 8;

function makeCountertopAgreementSpec(): CountertopAgreementSpec {
  return {
    id: uid(),
    title: "",
    sinkSelection: "no-sink",
    gmdSinkType: "fabricated",
    fabricatedSinkStyle: "slanted-mitered",
    kitchenBathroomBrand: "",
    kitchenBathroomModel: "",
    kitchenBathroomColor: "",
    edgeThickness: "2cm",
    edgeProfile: "flat-polished",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseAmt(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cleanMoneyInput(value: string): string {
  return value.replace(/[^0-9.,]/g, "");
}

function normalizeMoneyOnBlur(value: string): string {
  if (!value.trim()) return "";
  return fmt(parseAmt(value));
}

function defsForType(type: InvoiceType): LineItemDef[] {
  return type === "cabinet" ? CABINET_LINE_DEFS : COUNTERTOP_LINE_DEFS;
}

function initLineItems(type: InvoiceType): Record<string, LineItemState> {
  const map: Record<string, LineItemState> = {};
  for (const def of defsForType(type)) {
    map[def.key] = {
      amount: "",
      depositPct: def.defaultPct,
      noInstallation: false,
    };
  }
  return map;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  initialSalesRep: string;
  appRole: string;
}

export default function PaymentTermClient({
  initialSalesRep,
  appRole = "sales",
}: Props) {
  const isAdmin = appRole === "admin";
  const searchParams = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";
  // Client / job search
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    null,
  );
  const [selectedJobId, setSelectedJobId] = useState("");

  const clientInputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Header fields
  const [salesRep, setSalesRep] = useState(initialSalesRep);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [revNum, setRevNum] = useState("1");
  const [clientDeposit, setClientDeposit] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedArtifactId, setSavedArtifactId] = useState<string | null>(null);
  const [paymentTermNumber, setPaymentTermNumber] = useState<string>("");
  const [sourceArtifactId, setSourceArtifactId] = useState<string | null>(null);
  const [showInCustomerFiles, setShowInCustomerFiles] = useState(true);
  const [showPrintDocModal, setShowPrintDocModal] = useState(false);
  const [countertopSpecsSaving, setCountertopSpecsSaving] = useState(false);
  const [agreementTemplates, setAgreementTemplates] = useState<
    AgreementFormTemplateLite[]
  >([
    { key: "payment_term", title: "Payment Term", isActive: true },
    {
      key: "cabinet_agreement",
      title: "Cabinet Agreement",
      isActive: true,
    },
    {
      key: "countertop_agreement",
      title: "Countertop Agreement",
      isActive: true,
    },
    { key: "repair_agreement", title: "Repair Agreement", isActive: true },
    { key: "honed_agreement", title: "Honed Agreement", isActive: true },
  ]);
  const [printDocs, setPrintDocs] = useState({
    paymentTerm: true,
    cabinetAgreement: false,
    countertopAgreement: false,
    repairAgreement: false,
    honedAgreement: false,
  });
  const [countertopAgreementSpecs, setCountertopAgreementSpecs] = useState<
    CountertopAgreementSpec[]
  >([]);
  const [activeModelDropdownSpecId, setActiveModelDropdownSpecId] = useState<
    string | null
  >(null);
  const [sinkCatalog, setSinkCatalog] = useState<SinkCatalogItem[]>([]);
  const [sinkBrandOptions, setSinkBrandOptions] = useState<string[]>([]);

  // Invoices
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const firstId = uid();
    return [{ id: firstId, num: "", amount: "", type: "cabinet" }];
  });

  // Per-invoice line items
  const [lineItemsByInvoice, setLineItemsByInvoice] = useState<
    Record<string, Record<string, LineItemState>>
  >(() => {
    const firstId = invoices[0]?.id;
    if (!firstId) return {};
    return { [firstId]: initLineItems("cabinet") };
  });

  // ── Dropdown positioning ──────────────────────────────────────────────────

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

  // ── Client search ─────────────────────────────────────────────────────────

  async function searchClients(q: string) {
    setClientSearch(q);
    if (q.trim().length < 2) {
      setClientResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await fetch(
        `/api/payment-terms/lookup?q=${encodeURIComponent(q)}`,
      );
      const json = await res.json();
      setClientResults(Array.isArray(json.results) ? json.results : []);
    } catch {
      setClientResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  function pickClient(c: ClientOption) {
    setSelectedClient(c);
    setClientSearch(c.displayName);
    setSelectedJobId(c.jobs[0]?.id || "");
    setClientResults([]);
  }

  function clearClient() {
    setSelectedClient(null);
    setClientSearch("");
    setSelectedJobId("");
    setClientResults([]);
  }

  const selectedJob = useMemo(
    () => selectedClient?.jobs.find((j) => j.id === selectedJobId) ?? null,
    [selectedClient, selectedJobId],
  );

  useEffect(() => {
    const rawArtifactId = searchParams.get("artifactId");
    const mode = (searchParams.get("mode") || "").toLowerCase();
    const artifactId = rawArtifactId?.trim();

    if (!artifactId) {
      // Reset form to new state when there's no artifactId
      clearClient();
      setSalesRep(initialSalesRep);
      setDate(new Date().toISOString().slice(0, 10));
      setRevNum("1");
      setClientDeposit("");
      setSavedArtifactId(null);
      setPaymentTermNumber("");
      setSourceArtifactId(null);
      setShowInCustomerFiles(true);
      setSaveMessage(null);
      setSaveError(null);
      const firstInvoiceId = uid();
      setInvoices([
        { id: firstInvoiceId, num: "", amount: "", type: "cabinet" },
      ]);
      setLineItemsByInvoice({
        [firstInvoiceId]: initLineItems("cabinet"),
      });
      setCountertopAgreementSpecs([]);
      setPrintDocs({
        paymentTerm: true,
        cabinetAgreement: false,
        countertopAgreement: false,
        repairAgreement: false,
        honedAgreement: false,
      });
      return;
    }
    const artifactIdValue = artifactId;

    async function loadFromArtifact() {
      setSaveError(null);
      setSaveMessage(null);
      try {
        const response = await fetch(
          `/api/payment-terms?id=${encodeURIComponent(artifactIdValue)}`,
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Failed to load payment term");
        }

        const meta = (json?.metadata ?? {}) as any;

        const loadedClient: ClientOption = {
          id: String(meta.customerId || ""),
          displayName: String(meta.customerName || "-"),
          pipedriveId:
            typeof meta.customerPipedriveId === "string"
              ? meta.customerPipedriveId
              : null,
          contractor:
            typeof meta.contractor === "string" ? meta.contractor : null,
          customerAddress:
            typeof meta.customerAddress === "string"
              ? meta.customerAddress
              : null,
          jobs: [
            {
              id: String(meta.jobId || ""),
              dealId: typeof meta.dealId === "string" ? meta.dealId : null,
              dealName:
                typeof meta.dealName === "string" ? meta.dealName : null,
              address: typeof meta.address === "string" ? meta.address : null,
              status:
                typeof meta.jobStatus === "string" ? meta.jobStatus : "LOADED",
            },
          ].filter((j) => Boolean(j.id)),
        };

        if (loadedClient.id) {
          setSelectedClient(loadedClient);
          setClientSearch(loadedClient.displayName);
          setSelectedJobId(loadedClient.jobs[0]?.id || "");
        }

        setSalesRep(
          typeof meta.salesRep === "string" ? meta.salesRep : initialSalesRep,
        );
        setDate(
          typeof meta.date === "string"
            ? meta.date
            : new Date().toISOString().slice(0, 10),
        );

        const rawRev = Number(String(meta.revNum || "1"));
        const nextRev = Number.isFinite(rawRev) ? rawRev + 1 : 2;
        setRevNum(
          mode === "edit" ? String(nextRev) : String(meta.revNum || "1"),
        );

        const loadedInvoices = Array.isArray(meta.invoices)
          ? meta.invoices
          : [];
        setInvoices(
          loadedInvoices.length > 0
            ? loadedInvoices.map((inv: any) => ({
                id: String(inv.id || uid()),
                num: String(inv.num || ""),
                amount: String(inv.amount || ""),
                type: inv.type === "countertop" ? "countertop" : "cabinet",
              }))
            : [{ id: uid(), num: "", amount: "", type: "cabinet" }],
        );

        const loadedLineItems =
          meta.lineItemsByInvoice && typeof meta.lineItemsByInvoice === "object"
            ? meta.lineItemsByInvoice
            : {};
        setLineItemsByInvoice(loadedLineItems);

        const loadedClientDeposit = Number(meta?.totals?.clientDeposit);
        setClientDeposit(
          Number.isFinite(loadedClientDeposit) ? fmt(loadedClientDeposit) : "",
        );

        const visibility = meta?.showInCustomerFiles;
        setShowInCustomerFiles(visibility !== false);

        const loadedSpecs = Array.isArray(meta?.countertopAgreementSpecs)
          ? meta.countertopAgreementSpecs
          : [];
        setCountertopAgreementSpecs(
          loadedSpecs.length > 0
            ? loadedSpecs.map((spec: any) => ({
                id: String(spec?.id || uid()),
                title: String(spec?.title || ""),
                sinkSelection:
                  spec?.sinkSelection === "gmd-sink" ||
                  spec?.sinkSelection === "client-sink"
                    ? spec.sinkSelection
                    : "no-sink",
                gmdSinkType:
                  spec?.gmdSinkType === "kitchen-bathroom"
                    ? "kitchen-bathroom"
                    : "fabricated",
                fabricatedSinkStyle:
                  spec?.fabricatedSinkStyle === "slanted-undermount" ||
                  spec?.fabricatedSinkStyle === "rectangular-mitered" ||
                  spec?.fabricatedSinkStyle === "rectangular-undermount"
                    ? spec.fabricatedSinkStyle
                    : "slanted-mitered",
                kitchenBathroomBrand: String(spec?.kitchenBathroomBrand || ""),
                kitchenBathroomModel: String(spec?.kitchenBathroomModel || ""),
                kitchenBathroomColor: String(spec?.kitchenBathroomColor || ""),
                edgeThickness:
                  spec?.edgeThickness === "3cm" ||
                  spec?.edgeThickness === "2cm-build-up" ||
                  spec?.edgeThickness === "3cm-build-up"
                    ? spec.edgeThickness
                    : "2cm",
                edgeProfile:
                  spec?.edgeProfile === "beveled-1-4" ||
                  spec?.edgeProfile === "beveled-1-2" ||
                  spec?.edgeProfile === "beveled-3-4" ||
                  spec?.edgeProfile === "half-bullnose" ||
                  spec?.edgeProfile === "full-bullnose" ||
                  spec?.edgeProfile === "mitered" ||
                  spec?.edgeProfile === "waterfall" ||
                  spec?.edgeProfile === "ogee" ||
                  spec?.edgeProfile === "custom"
                    ? spec.edgeProfile
                    : "flat-polished",
                customEdgeProfile: String(spec?.customEdgeProfile || ""),
              }))
            : [],
        );

        setPaymentTermNumber(String(meta.paymentTermNumber || ""));
        setSavedArtifactId(String(json?.id || ""));
        setSourceArtifactId(String(json?.id || artifactId));
        setSaveMessage(
          mode === "edit"
            ? `Loaded ${meta.paymentTermNumber || "payment term"} for new revision.`
            : `Loaded ${meta.paymentTermNumber || "payment term"}.`,
        );
      } catch (error: any) {
        setSaveError(error?.message || "Failed to load payment term");
      }
    }

    void loadFromArtifact();
  }, [initialSalesRep, searchParams]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAgreementTemplates() {
      try {
        const response = await fetch("/api/settings/agreement-forms", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data?.templates) || isCancelled) {
          return;
        }

        const next = data.templates.map((row: any) => ({
          key: String(row?.key || ""),
          title: String(row?.title || ""),
          isActive: Boolean(row?.isActive),
        }));

        setAgreementTemplates([
          { key: "payment_term", title: "Payment Term", isActive: true },
          ...next,
        ]);
      } catch {
        // Keep the local fallback list if the API request fails.
      }
    }

    void loadAgreementTemplates();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadSinkCatalog() {
      try {
        const response = await fetch("/api/sinks?status=AVAILABLE", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data?.sinks) || isCancelled) {
          return;
        }

        const catalog: SinkCatalogItem[] = data.sinks
          .map((row: any) => ({
            brandName: String(row?.brandName || "").trim(),
            model: String(row?.model || "").trim(),
          }))
          .filter((row: SinkCatalogItem) => row.brandName && row.model);

        const brands = Array.from(
          new Set(catalog.map((row) => row.brandName)),
        ).sort((a, b) => a.localeCompare(b));

        setSinkCatalog(catalog);
        setSinkBrandOptions(brands);
      } catch {
        // Keep empty options if this request fails.
      }
    }

    void loadSinkCatalog();

    return () => {
      isCancelled = true;
    };
  }, []);

  // ── Invoice management ────────────────────────────────────────────────────

  function addInvoice() {
    if (invoices.length >= MAX_INVOICES) return;
    const newId = uid();
    setInvoices((prev) => [
      ...prev,
      { id: newId, num: "", amount: "", type: "cabinet" },
    ]);
    setLineItemsByInvoice((prev) => ({
      ...prev,
      [newId]: initLineItems("cabinet"),
    }));
  }

  function removeInvoice(id: string) {
    if (invoices.length <= 1) return;
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    setLineItemsByInvoice((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateInvoice(id: string, patch: Partial<Invoice>) {
    if (patch.type) {
      setLineItemsByInvoice((prev) => ({
        ...prev,
        [id]: initLineItems(patch.type as InvoiceType),
      }));
    }

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)),
    );
  }

  // ── Line item management ──────────────────────────────────────────────────

  function updateLineItem(
    invoiceId: string,
    key: string,
    patch: Partial<LineItemState>,
  ) {
    setLineItemsByInvoice((prev) => ({
      ...prev,
      [invoiceId]: {
        ...(prev[invoiceId] ?? {}),
        [key]: {
          ...(prev[invoiceId]?.[key] ?? {
            amount: "",
            depositPct: 50,
            noInstallation: false,
          }),
          ...patch,
        },
      },
    }));
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const computed = useMemo(() => {
    const totalInvoiceAmount = invoices.reduce(
      (sum, inv) => sum + parseAmt(inv.amount),
      0,
    );

    type InvoiceResult = {
      id: string;
      type: InvoiceType;
      invoiceNumber: string;
      invoiceAmount: number;
      lines: Array<{
        key: string;
        label: string;
        amount: number;
        depositPct: number;
        deposit: number;
        balance: number;
      }>;
      total: number;
      deposit: number;
      balance: number;
    };

    const perInvoice: InvoiceResult[] = invoices.map((invoice) => {
      const defs = defsForType(invoice.type);
      const stateMap =
        lineItemsByInvoice[invoice.id] ?? initLineItems(invoice.type);
      const invoiceAmount = parseAmt(invoice.amount);

      const cabinetRemainingAmount =
        invoice.type === "cabinet"
          ? invoiceAmount -
            CABINET_LINE_DEFS.filter((def) => def.key !== "cab_cabinet").reduce(
              (sum, def) => {
                const state = stateMap[def.key] ?? {
                  amount: "",
                  depositPct: def.defaultPct,
                  noInstallation: false,
                };
                return sum + parseAmt(state.amount);
              },
              0,
            )
          : 0;

      const noInstallationEnabled =
        invoice.type === "cabinet" &&
        parseAmt(stateMap["cab_installation"]?.amount ?? "") <= 0;

      const lines = defs.map((def) => {
        const state = stateMap[def.key] ?? {
          amount: "",
          depositPct: def.defaultPct,
          noInstallation: false,
        };

        const isAutoRemainingCabinet =
          invoice.type === "cabinet" && def.key === "cab_cabinet";

        const isCabOthers =
          invoice.type === "cabinet" && def.key === "cab_others";

        const amount = isAutoRemainingCabinet
          ? cabinetRemainingAmount
          : invoice.type === "countertop" && def.key === "ct_misc"
            ? invoiceAmount -
              COUNTERTOP_LINE_DEFS.filter((d) => d.key !== "ct_misc").reduce(
                (sum, d) => {
                  const s = stateMap[d.key] ?? {
                    amount: "",
                    depositPct: d.defaultPct,
                  };
                  return sum + parseAmt(s.amount);
                },
                0,
              )
            : parseAmt(state.amount);

        const depositPct =
          (isAutoRemainingCabinet || isCabOthers) && noInstallationEnabled
            ? 100
            : Math.max(0, Math.min(100, state.depositPct));
        const deposit = amount * (depositPct / 100);
        const balance = amount - deposit;
        return {
          key: def.key,
          label: def.label,
          amount,
          depositPct,
          deposit,
          balance,
        };
      });

      const total = lines.reduce((sum, line) => sum + line.amount, 0);
      const deposit = lines.reduce((sum, line) => sum + line.deposit, 0);
      const balance = total - deposit;

      return {
        id: invoice.id,
        type: invoice.type,
        invoiceNumber: invoice.num,
        invoiceAmount,
        lines,
        total,
        deposit,
        balance,
      };
    });

    const grandTotal = perInvoice.reduce((sum, inv) => sum + inv.total, 0);
    const grandDeposit = perInvoice.reduce((sum, inv) => sum + inv.deposit, 0);
    const grandBalance = grandTotal - grandDeposit;

    const byType = {
      cabinet: {
        total: perInvoice
          .filter((inv) => inv.type === "cabinet")
          .reduce((sum, inv) => sum + inv.total, 0),
        deposit: perInvoice
          .filter((inv) => inv.type === "cabinet")
          .reduce((sum, inv) => sum + inv.deposit, 0),
        balance: perInvoice
          .filter((inv) => inv.type === "cabinet")
          .reduce((sum, inv) => sum + inv.balance, 0),
      },
      countertop: {
        total: perInvoice
          .filter((inv) => inv.type === "countertop")
          .reduce((sum, inv) => sum + inv.total, 0),
        deposit: perInvoice
          .filter((inv) => inv.type === "countertop")
          .reduce((sum, inv) => sum + inv.deposit, 0),
        balance: perInvoice
          .filter((inv) => inv.type === "countertop")
          .reduce((sum, inv) => sum + inv.balance, 0),
      },
    };

    return {
      perInvoice,
      byType,
      grandTotal,
      grandDeposit,
      grandBalance,
      totalInvoiceAmount,
    };
  }, [invoices, lineItemsByInvoice]);

  const effectiveDeposit = useMemo(() => {
    const typed = parseAmt(clientDeposit);
    if (clientDeposit.trim().length === 0) {
      return computed.grandDeposit;
    }
    return typed;
  }, [clientDeposit, computed.grandDeposit]);

  const effectiveBalance = computed.totalInvoiceAmount - effectiveDeposit;
  const typedClientDeposit = parseAmt(clientDeposit);
  const hasBelowMinClientDeposit =
    clientDeposit.trim().length > 0 &&
    typedClientDeposit < computed.grandDeposit;

  const adjustedInvoiceBreakdown = useMemo(() => {
    const count = computed.perInvoice.length;
    if (count === 0) return [];

    const diffCents = Math.round(
      (effectiveDeposit - computed.grandDeposit) * 100,
    );
    const adjustedDepositCents = computed.perInvoice.map((inv) =>
      Math.round(inv.deposit * 100),
    );
    const totalCents = computed.perInvoice.map((inv) =>
      Math.round(inv.total * 100),
    );

    // Initial even distribution across invoices.
    const baseCents = Math.trunc(diffCents / count);
    const remainderCents = diffCents - baseCents * count;
    const remainderSign =
      remainderCents === 0 ? 0 : remainderCents > 0 ? 1 : -1;
    const remainderAbs = Math.abs(remainderCents);

    for (let i = 0; i < count; i += 1) {
      adjustedDepositCents[i] +=
        baseCents + (i < remainderAbs ? remainderSign : 0);
    }

    // Clamp each invoice so deposits never exceed invoice total or drop below zero.
    for (let i = 0; i < count; i += 1) {
      adjustedDepositCents[i] = Math.max(
        0,
        Math.min(totalCents[i], adjustedDepositCents[i]),
      );
    }

    // Redistribute residual cents created by clamping.
    const targetTotalDepositCents = Math.round(effectiveDeposit * 100);
    let residual =
      targetTotalDepositCents -
      adjustedDepositCents.reduce((sum, v) => sum + v, 0);

    if (residual > 0) {
      for (let i = 0; i < count && residual > 0; i += 1) {
        const capacity = totalCents[i] - adjustedDepositCents[i];
        if (capacity <= 0) continue;
        const applied = Math.min(capacity, residual);
        adjustedDepositCents[i] += applied;
        residual -= applied;
      }
    } else if (residual < 0) {
      let deficit = Math.abs(residual);
      for (let i = count - 1; i >= 0 && deficit > 0; i -= 1) {
        const reducible = adjustedDepositCents[i];
        if (reducible <= 0) continue;
        const reduced = Math.min(reducible, deficit);
        adjustedDepositCents[i] -= reduced;
        deficit -= reduced;
      }
    }

    return computed.perInvoice.map((inv, index) => {
      const adjustedDeposit = adjustedDepositCents[index] / 100;
      const adjustedBalance =
        (totalCents[index] - adjustedDepositCents[index]) / 100;

      return {
        ...inv,
        adjustedDeposit,
        adjustedBalance,
      };
    });
  }, [computed.perInvoice, computed.grandDeposit, effectiveDeposit]);

  const hasCountertopInvoice = useMemo(
    () => invoices.some((inv) => inv.type === "countertop"),
    [invoices],
  );

  const hasCabinetInvoice = useMemo(
    () => invoices.some((inv) => inv.type === "cabinet"),
    [invoices],
  );

  function openPrintDocModal() {
    setPrintDocs((prev) => ({
      ...prev,
      cabinetAgreement: hasCabinetInvoice,
      countertopAgreement: hasCountertopInvoice,
    }));
    setShowPrintDocModal(true);
  }

  function closePrintDocModal() {
    setShowPrintDocModal(false);
  }

  function updateCountertopSpec(
    id: string,
    patch: Partial<CountertopAgreementSpec>,
  ) {
    setCountertopAgreementSpecs((prev) =>
      prev.map((spec) => (spec.id === id ? { ...spec, ...patch } : spec)),
    );
  }

  function addCountertopSpec() {
    setCountertopAgreementSpecs((prev) => [
      ...prev,
      makeCountertopAgreementSpec(),
    ]);
  }

  function removeCountertopSpec(id: string) {
    setCountertopAgreementSpecs((prev) =>
      prev.filter((spec) => spec.id !== id),
    );
  }

  function getKitchenBathroomModelOptions(spec: CountertopAgreementSpec) {
    const selectedBrand = spec.kitchenBathroomBrand.trim().toLowerCase();
    const query = spec.kitchenBathroomModel.trim().toLowerCase();

    return Array.from(
      new Set(
        sinkCatalog
          .filter((item) =>
            selectedBrand
              ? item.brandName.toLowerCase() === selectedBrand
              : true,
          )
          .map((item) => item.model)
          .filter((model) =>
            query ? model.toLowerCase().includes(query) : true,
          ),
      ),
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 30);
  }

  async function saveCountertopAgreementSpecs(opts?: { silent?: boolean }) {
    if (!savedArtifactId) {
      if (!opts?.silent) {
        setSaveError(
          "Save the payment term first, then save countertop specs.",
        );
      }
      return false;
    }

    setCountertopSpecsSaving(true);
    if (!opts?.silent) {
      setSaveError(null);
      setSaveMessage(null);
    }

    try {
      const response = await fetch("/api/payment-terms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: savedArtifactId,
          countertopAgreementSpecs,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "Failed to save countertop specs");
      }

      if (!opts?.silent) {
        setSaveMessage("Countertop agreement details saved.");
      }

      return true;
    } catch (error: any) {
      if (!opts?.silent) {
        setSaveError(error?.message || "Failed to save countertop specs");
      }
      return false;
    } finally {
      setCountertopSpecsSaving(false);
    }
  }

  async function printSelectedDocs() {
    if (
      !printDocs.paymentTerm &&
      !printDocs.cabinetAgreement &&
      !printDocs.countertopAgreement &&
      !printDocs.repairAgreement &&
      !printDocs.honedAgreement
    ) {
      setSaveError("Select at least one document to print.");
      return;
    }

    const selectedDocs = [
      printDocs.paymentTerm ? "payment_term" : null,
      printDocs.cabinetAgreement ? "cabinet_agreement" : null,
      printDocs.countertopAgreement ? "countertop_agreement" : null,
      printDocs.repairAgreement ? "repair_agreement" : null,
      printDocs.honedAgreement ? "honed_agreement" : null,
    ].filter(Boolean) as Array<
      | "payment_term"
      | "cabinet_agreement"
      | "countertop_agreement"
      | "repair_agreement"
      | "honed_agreement"
    >;

    if (hasCountertopInvoice && savedArtifactId) {
      const saved = await saveCountertopAgreementSpecs({ silent: true });
      if (!saved) {
        setSaveError(
          "Could not save Additional Countertop Agreement. Please click Save next to that section and try again.",
        );
        return;
      }
    }

    closePrintDocModal();

    if (selectedDocs.length > 1) {
      if (!savedArtifactId) {
        setSaveError("Save first to generate print documents.");
        return;
      }

      setSaveError(null);

      const printUrls = selectedDocs.map((doc) => {
        if (doc === "payment_term") {
          return `/payment-term-print/${savedArtifactId}?autoprint=1`;
        }

        const params = new URLSearchParams({
          key: doc,
          autoprint: "1",
        });

        if (doc === "countertop_agreement") {
          params.set("specs", JSON.stringify(countertopAgreementSpecs));
        }

        return `/agreement-print/${savedArtifactId}?${params.toString()}`;
      });

      let openedCount = 0;
      for (let i = 0; i < printUrls.length; i += 1) {
        const url = printUrls[i];
        const doc = selectedDocs[i];

        if (doc && doc !== "payment_term") {
          recordPrintedAgreement(doc);
        }

        const popup = window.open(url, "_blank");
        if (popup) {
          openedCount += 1;
          popup.focus?.();
        }
      }

      if (openedCount === 0) {
        setSaveError(
          "Popup blocker prevented opening the print tabs. Please allow popups for this portal (localhost) and try again.",
        );
      } else if (openedCount < printUrls.length) {
        setSaveError(
          "Some print tabs could not be opened. Please allow popups for this portal (localhost) and try again.",
        );
      }

      return;
    }

    if (printDocs.paymentTerm) {
      openClientPrint();
    }

    if (printDocs.cabinetAgreement) {
      openAgreementPrint("cabinet_agreement");
    }

    if (printDocs.countertopAgreement) {
      openAgreementPrint("countertop_agreement");
    }

    if (printDocs.repairAgreement) {
      openAgreementPrint("repair_agreement");
    }

    if (printDocs.honedAgreement) {
      openAgreementPrint("honed_agreement");
    }
  }

  async function savePaymentTerm() {
    setSaveError(null);
    setSaveMessage(null);

    if (!selectedClient) {
      setSaveError("Please select a client first.");
      return;
    }

    if (!selectedJob) {
      setSaveError("Please select a deal/job first.");
      return;
    }

    setSaveLoading(true);
    try {
      const payload = {
        customerId: selectedClient.id,
        customerName: selectedClient.displayName,
        customerPipedriveId: selectedClient.pipedriveId,
        customerAddress: selectedClient.customerAddress,
        contractor: selectedClient.contractor,
        jobId: selectedJob.id,
        dealId: selectedJob.dealId,
        dealName: selectedJob.dealName,
        jobStatus: selectedJob.status,
        address: selectedJob.address,
        salesRep,
        date,
        revNum,
        invoices,
        lineItemsByInvoice,
        countertopAgreementSpecs,
        totals: {
          invoiceTotal: computed.totalInvoiceAmount,
          minimumDeposit: computed.grandDeposit,
          clientDeposit: effectiveDeposit,
          remainingBalance: effectiveBalance,
          byType: computed.byType,
        },
        adjustedInvoiceBreakdown,
        showInCustomerFiles,
        sourceArtifactId,
        savedAt: new Date().toISOString(),
      };

      const response = await fetch("/api/payment-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "Failed to save payment term");
      }

      const newArtifactId = typeof json?.id === "string" ? json.id.trim() : "";
      if (!newArtifactId) {
        throw new Error("Save succeeded but no artifact id was returned.");
      }

      setSavedArtifactId(newArtifactId);
      setSourceArtifactId(newArtifactId);
      setPaymentTermNumber(String(json?.paymentTermNumber || ""));
      setSaveMessage(
        `Saved as #${String(json?.paymentTermNumber || "payment term")}.`,
      );
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save payment term");
    } finally {
      setSaveLoading(false);
    }
  }

  function openCurrentPrint() {
    window.print();
  }

  function recordPrintedAgreement(
    agreementKey:
      | "cabinet_agreement"
      | "countertop_agreement"
      | "repair_agreement"
      | "honed_agreement",
  ) {
    if (!savedArtifactId) {
      return;
    }

    void fetch("/api/payment-terms/printed-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentTermArtifactId: savedArtifactId,
        agreementKey,
      }),
      keepalive: true,
    }).catch(() => {
      // Best-effort tracking only; printing should never fail if this call fails.
    });
  }

  function openClientPrint() {
    if (!savedArtifactId) {
      setSaveError("Save first to generate print documents.");
      return;
    }
    window.open(`/payment-term-print/${savedArtifactId}?autoprint=1`, "_blank");
  }

  function openAgreementPrint(
    agreementKey:
      | "cabinet_agreement"
      | "countertop_agreement"
      | "repair_agreement"
      | "honed_agreement",
  ) {
    if (!savedArtifactId) {
      setSaveError("Save first to generate print documents.");
      return;
    }

    const params = new URLSearchParams({
      key: agreementKey,
      autoprint: "1",
    });

    if (agreementKey === "countertop_agreement") {
      params.set("specs", JSON.stringify(countertopAgreementSpecs));
    }

    recordPrintedAgreement(agreementKey);

    window.open(
      `/agreement-print/${savedArtifactId}?${params.toString()}`,
      "_blank",
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pt-builder max-w-[1500px] mx-auto space-y-6 pb-12">
      {/* ── Page title ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isViewMode ? "View Payment Term" : "New Payment Term"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isViewMode
                ? "Viewing saved payment term — read only"
                : "Create a payment term document linked to a client and job"}
            </p>
            {paymentTermNumber && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                {isViewMode
                  ? `#${paymentTermNumber}`
                  : `Saved as #${paymentTermNumber}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isViewMode ? (
            <Link
              href={`/payment-terms?artifactId=${encodeURIComponent(searchParams.get("artifactId") ?? "")}&mode=edit`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              <FileText className="w-4 h-4" />
              Edit as New Revision
            </Link>
          ) : (
            <button
              type="button"
              onClick={savePaymentTerm}
              disabled={saveLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
            >
              {saveLoading ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={openCurrentPrint}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Printer className="w-4 h-4" />
            Current Layout
          </button>
          <button
            type="button"
            onClick={openPrintDocModal}
            disabled={!savedArtifactId}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Print Doc
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {saveError}
        </div>
      )}
      {saveMessage && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
          {saveMessage}
        </div>
      )}

      {/* ── Client & Job info ── */}
      <fieldset disabled={isViewMode} className="contents">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Client &amp; Job Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Customer search */}
            <div className="sm:col-span-2 relative">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Customer Name
              </label>
              <input
                ref={clientInputRef}
                type="text"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search by name, email, or deal…"
                value={clientSearch}
                onChange={(e) => searchClients(e.target.value)}
                autoComplete="off"
              />
              {loadingSearch && (
                <div className="absolute right-3 top-8 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {/* Dropdown portal */}
              {clientResults.length > 0 && dropdownRect && (
                <ul
                  className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-y-auto max-h-64"
                  style={{
                    top: dropdownRect.top + 4,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                  }}
                >
                  {clientResults.map((c) => (
                    <li
                      key={c.id}
                      className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                      onMouseDown={() => pickClient(c)}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {c.displayName}
                      </div>
                      {c.contractor && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {c.contractor}
                        </div>
                      )}
                      {c.jobs.length > 0 && (
                        <div className="text-xs text-blue-500 mt-0.5">
                          {c.jobs.length} job{c.jobs.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Job / Deal */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Job / Deal
              </label>
              {selectedClient && selectedClient.jobs.length > 0 ? (
                <select
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  {selectedClient.jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.dealName || j.dealId || j.id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/40 text-gray-400 cursor-not-allowed"
                  placeholder="Select a customer first"
                  disabled
                />
              )}
            </div>

            {/* Sales Rep */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Sales Rep
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={salesRep}
                onChange={(e) => setSalesRep(e.target.value)}
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Rev # */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Rev #
              </label>
              <input
                type="number"
                min="1"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={revNum}
                disabled={!isAdmin}
                onChange={(e) => setRevNum(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 p-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={showInCustomerFiles}
                  onChange={(e) => setShowInCustomerFiles(e.target.checked)}
                />
                Show this revision in Customer Files (associated job artifacts)
              </label>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Turn this on for the revision the team should see in Customers.
                Older payment term revisions stay saved but can remain hidden.
              </p>
            </div>

            {/* Selected job info */}
            {selectedJob && (
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-4 items-center pt-1 text-sm text-gray-600 dark:text-gray-400">
                {selectedJob.dealId && (
                  <span>
                    Job ID:{" "}
                    <strong className="text-gray-900 dark:text-gray-100">
                      {selectedJob.dealId}
                    </strong>
                  </span>
                )}
                {selectedJob.address && (
                  <span>
                    Address:{" "}
                    <strong className="text-gray-900 dark:text-gray-100">
                      {selectedJob.address}
                    </strong>
                  </span>
                )}
                {selectedJob.status && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {selectedJob.status}
                  </span>
                )}
                <button
                  onClick={clearClient}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500 underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div className="pt-builder-grid grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* ── LEFT: Invoices + per-invoice line items ── */}
          <div className="xl:col-span-7 space-y-6">
            {/* Invoices + Distribution attached to each invoice */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invoices
                </h2>
                <button
                  onClick={addInvoice}
                  disabled={invoices.length >= MAX_INVOICES}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Invoice
                  {invoices.length >= MAX_INVOICES && (
                    <span className="text-gray-400">(max {MAX_INVOICES})</span>
                  )}
                </button>
              </div>

              <div className="space-y-5">
                {invoices.map((inv, index) => {
                  const sectionMeta = SECTION_META[inv.type];
                  const defs = defsForType(inv.type);
                  const stateMap =
                    lineItemsByInvoice[inv.id] ?? initLineItems(inv.type);
                  const invoiceComputed = computed.perInvoice.find(
                    (i) => i.id === inv.id,
                  );
                  const distributionTotal = invoiceComputed?.total ?? 0;

                  return (
                    <div
                      key={inv.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="rounded-t-xl bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-1 flex items-end">
                            <span className="text-xs font-semibold text-gray-400">
                              #{index + 1}
                            </span>
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Invoice #
                            </label>
                            <input
                              type="text"
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="12345"
                              value={inv.num}
                              onChange={(e) =>
                                updateInvoice(inv.id, { num: e.target.value })
                              }
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Amount ($)
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md pl-6 pr-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0.00"
                                value={inv.amount}
                                onChange={(e) =>
                                  updateInvoice(inv.id, {
                                    amount: cleanMoneyInput(e.target.value),
                                  })
                                }
                                onBlur={(e) =>
                                  updateInvoice(inv.id, {
                                    amount: normalizeMoneyOnBlur(
                                      e.target.value,
                                    ),
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Type
                            </label>
                            <select
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={inv.type}
                              onChange={(e) =>
                                updateInvoice(inv.id, {
                                  type: e.target.value as InvoiceType,
                                })
                              }
                            >
                              <option value="cabinet">Cabinet</option>
                              <option value="countertop">Countertop</option>
                            </select>
                          </div>

                          <div className="md:col-span-1 flex items-end justify-end">
                            <button
                              onClick={() => removeInvoice(inv.id)}
                              disabled={invoices.length <= 1}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Remove invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-b-xl">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th
                                colSpan={3}
                                className={`py-2 px-3 text-xs font-bold uppercase tracking-wider text-left ${sectionMeta.headerCls}`}
                              >
                                ■ {sectionMeta.label} Distribution
                              </th>
                            </tr>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                                Line Item
                              </th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 min-w-[130px]">
                                Amount ($)
                              </th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 min-w-[120px]">
                                Deposit %
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {defs.map((def) => {
                              const state = stateMap[def.key] ?? {
                                amount: "",
                                depositPct: def.defaultPct,
                                noInstallation: false,
                              };

                              const isAutoRemainingCabinet =
                                inv.type === "cabinet" &&
                                def.key === "cab_cabinet";

                              const noInstallationEnabled =
                                inv.type === "cabinet" &&
                                parseAmt(
                                  stateMap["cab_installation"]?.amount ?? "",
                                ) <= 0;

                              const isCabOthers =
                                inv.type === "cabinet" &&
                                def.key === "cab_others";

                              const amountValue = isAutoRemainingCabinet
                                ? fmt(
                                    parseAmt(inv.amount) -
                                      (parseAmt(
                                        stateMap["cab_removal"]?.amount ?? "",
                                      ) +
                                        parseAmt(
                                          stateMap["cab_installation"]
                                            ?.amount ?? "",
                                        ) +
                                        parseAmt(
                                          stateMap["cab_others"]?.amount ?? "",
                                        )),
                                  )
                                : state.amount;
                              const isAutoRemainingMisc =
                                inv.type === "countertop" &&
                                def.key === "ct_misc";

                              const finalAmountValue = isAutoRemainingMisc
                                ? fmt(
                                    parseAmt(inv.amount) -
                                      (parseAmt(
                                        stateMap["ct_slab"]?.amount ?? "",
                                      ) +
                                        parseAmt(
                                          stateMap["ct_labor"]?.amount ?? "",
                                        ) +
                                        parseAmt(
                                          stateMap["ct_tile"]?.amount ?? "",
                                        ) +
                                        parseAmt(
                                          stateMap["ct_reconection"]?.amount ??
                                            "",
                                        )),
                                  )
                                : amountValue;

                              const depositPctValue =
                                isAutoRemainingCabinet && noInstallationEnabled
                                  ? 100
                                  : isCabOthers && noInstallationEnabled
                                    ? 100
                                    : state.depositPct;

                              return (
                                <tr
                                  key={`${inv.id}-${def.key}`}
                                  className={`border-b border-gray-100 dark:border-gray-700/50 ${sectionMeta.rowCls}`}
                                >
                                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                    {def.accent ? (
                                      <span className="font-medium text-orange-600 dark:text-orange-400">
                                        {def.label}
                                      </span>
                                    ) : (
                                      def.label
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                                        $
                                      </span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md pl-6 pr-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                        value={finalAmountValue}
                                        disabled={
                                          isAutoRemainingCabinet ||
                                          isAutoRemainingMisc
                                        }
                                        onChange={(e) =>
                                          updateLineItem(inv.id, def.key, {
                                            amount: cleanMoneyInput(
                                              e.target.value,
                                            ),
                                          })
                                        }
                                        onBlur={(e) =>
                                          updateLineItem(inv.id, def.key, {
                                            amount: normalizeMoneyOnBlur(
                                              e.target.value,
                                            ),
                                          })
                                        }
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-3">
                                      <div className="relative w-16">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="1"
                                          className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-gray-300 dark:border-gray-600 rounded-md pl-2 pr-5 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:dark:bg-gray-700/40 disabled:text-gray-400 disabled:cursor-not-allowed"
                                          value={depositPctValue}
                                          disabled={
                                            !isAdmin ||
                                            (noInstallationEnabled &&
                                              (isAutoRemainingCabinet ||
                                                isCabOthers))
                                          }
                                          onChange={(e) =>
                                            updateLineItem(inv.id, def.key, {
                                              depositPct: Number(
                                                e.target.value,
                                              ),
                                            })
                                          }
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                                          %
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr
                              className={`border-t border-gray-200 dark:border-gray-700 ${sectionMeta.subCls}`}
                            >
                              <td className="py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                Distribution Total
                              </td>
                              <td className="py-2 px-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                                ${fmt(distributionTotal)}
                              </td>
                              <td className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/20 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between">
                  <span>Total of Invoices</span>
                  <span>${fmt(computed.totalInvoiceAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Payment Term Summary ── */}
          <div className="xl:col-span-5">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sticky top-6">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-5">
                Payment Term — Rules
              </h2>

              {/* Per-type breakdown */}
              {(["cabinet", "countertop"] as InvoiceType[]).map((section) => {
                const meta = SECTION_META[section];
                const sec = computed.byType[section];

                return (
                  <div key={section} className="mb-6">
                    {/* Section header */}
                    <div
                      className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-t-md ${meta.headerCls}`}
                    >
                      ■ {meta.label}
                    </div>

                    <table className="w-full text-xs border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-md overflow-hidden">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                          <th className="text-left py-1.5 px-3 font-medium text-gray-600 dark:text-gray-400">
                            Metric
                          </th>
                          <th className="text-right py-1.5 px-2 font-medium text-gray-600 dark:text-gray-400">
                            Total
                          </th>
                          <th className="text-right py-1.5 px-2 font-medium text-green-700 dark:text-green-400">
                            Deposit
                          </th>
                          <th className="text-right py-1.5 px-3 font-medium text-gray-600 dark:text-gray-400">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300">
                            All {meta.label} Lines
                          </td>
                          <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-300">
                            ${fmt(sec.total)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold text-green-700 dark:text-green-400">
                            ${fmt(sec.deposit)}
                          </td>
                          <td className="py-1.5 px-3 text-right text-gray-700 dark:text-gray-300">
                            ${fmt(sec.balance)}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr
                          className={`border-t-2 border-gray-300 dark:border-gray-600 ${meta.subCls} dark:bg-transparent`}
                        >
                          <td className="py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                            Subtotal
                          </td>
                          <td className="py-2 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">
                            ${fmt(sec.total)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-green-700 dark:text-green-400">
                            ${fmt(sec.deposit)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-700 dark:text-gray-300">
                            ${fmt(sec.balance)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}

              {/* Grand totals */}
              <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    ${fmt(computed.totalInvoiceAmount)}
                  </span>
                </div>
                <div className="border-t border-blue-200 dark:border-blue-700 pt-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Minimum Deposit
                  </span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-400">
                    ${fmt(computed.grandDeposit)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Remaining Balance
                  </span>
                  <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    ${fmt(effectiveBalance)}
                  </span>
                </div>
              </div>

              {/* Client deposit override */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Client Deposit
                  </label>
                  {typedClientDeposit > computed.grandDeposit && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      +${fmt(typedClientDeposit - computed.grandDeposit)} above
                      minimum
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-sm">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={fmt(computed.grandDeposit)}
                    className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${hasBelowMinClientDeposit ? "border-red-400 dark:border-red-600 focus:ring-red-500" : "border-blue-300 dark:border-blue-700 focus:ring-blue-500"}`}
                    value={clientDeposit}
                    onChange={(e) =>
                      setClientDeposit(cleanMoneyInput(e.target.value))
                    }
                    onBlur={(e) =>
                      setClientDeposit(normalizeMoneyOnBlur(e.target.value))
                    }
                  />
                </div>
                {hasBelowMinClientDeposit && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    Client deposit is below minimum required ($
                    {fmt(computed.grandDeposit)}).
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Min: ${fmt(computed.grandDeposit)} — leave blank to use
                  minimum
                </p>
              </div>

              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Per Invoice Breakdown
                </h3>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-[320px]">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="text-left py-1.5 px-3 font-medium text-gray-600 dark:text-gray-400 rounded-tl">
                          Invoice
                        </th>
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-gray-400">
                          Type
                        </th>
                        <th className="text-right py-1.5 px-2 font-medium text-gray-600 dark:text-gray-400">
                          Amount
                        </th>
                        <th className="text-right py-1.5 px-2 font-medium text-green-700 dark:text-green-400">
                          Deposit
                        </th>
                        <th className="text-right py-1.5 px-3 font-medium text-orange-600 dark:text-orange-400 rounded-tr">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustedInvoiceBreakdown.map((inv, index) => (
                        <tr
                          key={inv.id}
                          className="border-b border-gray-100 dark:border-gray-700/50"
                        >
                          <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300 font-medium">
                            {inv.invoiceNumber
                              ? `#${inv.invoiceNumber}`
                              : `Invoice ${index + 1}`}
                          </td>
                          <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400 capitalize">
                            {inv.type}
                          </td>
                          <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-300">
                            ${fmt(inv.total)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold text-green-700 dark:text-green-400">
                            ${fmt(inv.adjustedDeposit)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-semibold text-orange-600 dark:text-orange-400">
                            ${fmt(inv.adjustedBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      {showPrintDocModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={closePrintDocModal}
          />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Print Options
                </h3>
                <button
                  type="button"
                  onClick={closePrintDocModal}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
                <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Terms and Agreements
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {agreementTemplates
                      .filter((tpl) => tpl.isActive)
                      .map((tpl) => {
                        const checked =
                          tpl.key === "payment_term"
                            ? printDocs.paymentTerm
                            : tpl.key === "cabinet_agreement"
                              ? printDocs.cabinetAgreement
                              : tpl.key === "countertop_agreement"
                                ? printDocs.countertopAgreement
                                : tpl.key === "repair_agreement"
                                  ? printDocs.repairAgreement
                                  : tpl.key === "honed_agreement"
                                    ? printDocs.honedAgreement
                                    : false;

                        return (
                          <label
                            key={tpl.key}
                            className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={checked}
                              onChange={(e) =>
                                setPrintDocs((prev) => {
                                  if (tpl.key === "payment_term") {
                                    return {
                                      ...prev,
                                      paymentTerm: e.target.checked,
                                    };
                                  }
                                  if (tpl.key === "cabinet_agreement") {
                                    return {
                                      ...prev,
                                      cabinetAgreement: e.target.checked,
                                    };
                                  }
                                  if (tpl.key === "countertop_agreement") {
                                    return {
                                      ...prev,
                                      countertopAgreement: e.target.checked,
                                    };
                                  }
                                  if (tpl.key === "repair_agreement") {
                                    return {
                                      ...prev,
                                      repairAgreement: e.target.checked,
                                    };
                                  }
                                  if (tpl.key === "honed_agreement") {
                                    return {
                                      ...prev,
                                      honedAgreement: e.target.checked,
                                    };
                                  }
                                  return prev;
                                })
                              }
                            />
                            {tpl.title}
                          </label>
                        );
                      })}
                  </div>
                </section>

                {hasCountertopInvoice && (
                  <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Sink/Edge/Thickness Document
                      </h4>
                      <button
                        type="button"
                        onClick={() => void saveCountertopAgreementSpecs()}
                        disabled={!savedArtifactId || countertopSpecsSaving}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {countertopSpecsSaving ? "Saving..." : "Save"}
                      </button>
                    </div>

                    {countertopAgreementSpecs.map((spec, idx) => (
                      <div
                        key={spec.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {spec.title.trim() || `Area #${idx + 1}`}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCountertopSpec(spec.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Area Title
                          </label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                            placeholder={`Area #${idx + 1}`}
                            value={spec.title}
                            onChange={(e) =>
                              updateCountertopSpec(spec.id, {
                                title: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Sinks
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Sink Selection
                              </label>
                              <select
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                value={spec.sinkSelection}
                                onChange={(e) =>
                                  updateCountertopSpec(spec.id, {
                                    sinkSelection: e.target
                                      .value as SinkSelection,
                                  })
                                }
                              >
                                <option value="no-sink">No Sink</option>
                                <option value="gmd-sink">GMD Sink</option>
                                <option value="client-sink">Client Sink</option>
                              </select>
                            </div>

                            {spec.sinkSelection === "gmd-sink" && (
                              <>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    GMD Sink Type
                                  </label>
                                  <select
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                    value={spec.gmdSinkType}
                                    onChange={(e) =>
                                      updateCountertopSpec(spec.id, {
                                        gmdSinkType: e.target
                                          .value as GmdSinkType,
                                      })
                                    }
                                  >
                                    <option value="fabricated">
                                      Fabricated Sink
                                    </option>
                                    <option value="kitchen-bathroom">
                                      Kitchen/Bathroom Sink
                                    </option>
                                  </select>
                                </div>

                                {spec.gmdSinkType === "fabricated" && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                      Fabricated Style
                                    </label>
                                    <select
                                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                      value={spec.fabricatedSinkStyle}
                                      onChange={(e) =>
                                        updateCountertopSpec(spec.id, {
                                          fabricatedSinkStyle: e.target
                                            .value as FabricatedSinkStyle,
                                        })
                                      }
                                    >
                                      <option value="slanted-mitered">
                                        Slanted Mitered
                                      </option>
                                      <option value="slanted-undermount">
                                        Slanted Undermount
                                      </option>
                                      <option value="rectangular-mitered">
                                        Rectangular Mitered
                                      </option>
                                      <option value="rectangular-undermount">
                                        Rectangular Undermount
                                      </option>
                                    </select>
                                  </div>
                                )}

                                {spec.gmdSinkType === "kitchen-bathroom" && (
                                  <>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Sink Brand
                                      </label>
                                      <select
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                        value={spec.kitchenBathroomBrand}
                                        onChange={(e) =>
                                          updateCountertopSpec(spec.id, {
                                            kitchenBathroomBrand:
                                              e.target.value,
                                            kitchenBathroomModel: "",
                                          })
                                        }
                                      >
                                        <option value="">Select brand</option>
                                        {sinkBrandOptions.map((brandName) => (
                                          <option
                                            key={brandName}
                                            value={brandName}
                                          >
                                            {brandName}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Kitchen/Bathroom Model
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                          placeholder={
                                            spec.kitchenBathroomBrand
                                              ? "Type model to search"
                                              : "Select sink brand first"
                                          }
                                          value={spec.kitchenBathroomModel}
                                          disabled={!spec.kitchenBathroomBrand}
                                          onFocus={() =>
                                            setActiveModelDropdownSpecId(
                                              spec.id,
                                            )
                                          }
                                          onBlur={() => {
                                            window.setTimeout(() => {
                                              setActiveModelDropdownSpecId(
                                                (prev) =>
                                                  prev === spec.id
                                                    ? null
                                                    : prev,
                                              );
                                            }, 120);
                                          }}
                                          onChange={(e) => {
                                            updateCountertopSpec(spec.id, {
                                              kitchenBathroomModel:
                                                e.target.value,
                                            });
                                            setActiveModelDropdownSpecId(
                                              spec.id,
                                            );
                                          }}
                                        />

                                        {spec.kitchenBathroomBrand &&
                                          activeModelDropdownSpecId ===
                                            spec.id &&
                                          getKitchenBathroomModelOptions(spec)
                                            .length > 0 && (
                                            <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                                              {getKitchenBathroomModelOptions(
                                                spec,
                                              ).map((model) => (
                                                <button
                                                  key={`${spec.id}-${model}`}
                                                  type="button"
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    updateCountertopSpec(
                                                      spec.id,
                                                      {
                                                        kitchenBathroomModel:
                                                          model,
                                                      },
                                                    );
                                                    setActiveModelDropdownSpecId(
                                                      null,
                                                    );
                                                  }}
                                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                >
                                                  {model}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Color
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                        placeholder="Type sink color"
                                        value={spec.kitchenBathroomColor}
                                        onChange={(e) =>
                                          updateCountertopSpec(spec.id, {
                                            kitchenBathroomColor:
                                              e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Countertop Edge
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Thickness
                              </label>
                              <select
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                value={spec.edgeThickness}
                                onChange={(e) =>
                                  updateCountertopSpec(spec.id, {
                                    edgeThickness: e.target
                                      .value as EdgeThickness,
                                  })
                                }
                              >
                                <option value="2cm">2CM</option>
                                <option value="3cm">3CM</option>
                                <option value="2cm-build-up">
                                  2CM Build-UP
                                </option>
                                <option value="3cm-build-up">
                                  3CM Build-UP
                                </option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Edge Profile
                              </label>
                              <select
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                value={spec.edgeProfile}
                                onChange={(e) =>
                                  updateCountertopSpec(spec.id, {
                                    edgeProfile: e.target.value as EdgeProfile,
                                  })
                                }
                              >
                                <option value="flat-polished">
                                  Flat Polished
                                </option>
                                <option value="beveled-1-4">Beveled 1/4</option>
                                <option value="beveled-1-2">Beveled 1/2</option>
                                {(spec.edgeThickness === "3cm" ||
                                  spec.edgeThickness === "2cm-build-up" ||
                                  spec.edgeThickness === "3cm-build-up") && (
                                  <option value="beveled-3-4">
                                    Beveled 3/4
                                  </option>
                                )}
                                <option value="half-bullnose">
                                  Half Bullnose
                                </option>
                                <option value="full-bullnose">
                                  Full Bullnose
                                </option>
                                <option value="mitered">Mitered</option>
                                <option value="waterfall">Waterfall</option>
                                <option value="ogee">Ogee</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>
                            {spec.edgeProfile === "custom" && (
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Custom Edge Profile Description
                                </label>
                                <input
                                  type="text"
                                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-2 text-sm bg-white dark:bg-gray-700"
                                  placeholder="Describe the custom edge profile"
                                  value={spec.customEdgeProfile || ""}
                                  onChange={(e) =>
                                    updateCountertopSpec(spec.id, {
                                      customEdgeProfile: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addCountertopSpec}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </section>
                )}
              </div>

              <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closePrintDocModal}
                  className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={printSelectedDocs}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
                >
                  <Printer className="w-4 h-4" />
                  Print Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
