"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Save, Trash2, X } from "lucide-react";

type CalcMode = "flat" | "perItem" | "higher";

type Settings = {
  installationBasePercent: number;
  installationCalcMode: CalcMode;
  customSurchargePercent: number;
  costTaxPercent: number;
};

type InstallationServiceItem = {
  id: string;
  code: string | null;
  description: string;
  salePrice: number;
  bucketDefault: BucketDefault;
};

type InstallationType = {
  id: string;
  name: string;
  description?: string;
  multiplier: number;
  sortOrder: number;
  isActive: boolean;
};

// Round 12: Removal Types (header dropdown - percent of the Cabinets total,
// pre-discount, auto-computes the Removal $ amount) and Project Types
// (header dropdown - for now just a manageable list of names, no
// calculation tied to it per Diego's explicit "for now" scoping).
type RemovalType = {
  id: string;
  name: string;
  percent: number;
  sortOrder: number;
  isActive: boolean;
};

type ProjectType = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type DiscountOption = {
  id: string;
  percent: number;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

type ParametersBundle = {
  settings: Settings;
  installationServiceItems: InstallationServiceItem[];
  installationTypes: InstallationType[];
  removalTypes: RemovalType[];
  projectTypes: ProjectType[];
  discountOptions: DiscountOption[];
};

// Round 11 follow-up: moved in from the old standalone Special
// Customization Settings page (/cabinet-estimates/settings, now removed).
type SpecialCustomizationItem = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

interface Props {
  initialParameters: ParametersBundle;
  initialSpecialCustomizationItems: SpecialCustomizationItem[];
}

// Full admin-management shape (includes inactive rows, unlike the
// active-only list in ParametersBundle used for the estimate form's own
// live preview).
type BucketDefault = "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC" | null;

const BUCKET_DEFAULT_LABELS: Record<Exclude<BucketDefault, null>, string> = {
  STANDARD: "Standard",
  DOUBLE: "Double",
  CUSTOM: "Custom",
  MISC: "Misc",
};

type InstallationItemRow = {
  id: string;
  code: string | null;
  description: string;
  salePrice: number;
  isActive: boolean;
  sortOrder: number;
  // Round 12 follow-up: when set, every catalog item whose own
  // CabinetSummaryBucket matches auto-assigns to this installation item at
  // import time - deterministic, no AI guessing involved. See the schema
  // comment on CabinetInstallationServiceItem.bucketDefault.
  bucketDefault: BucketDefault;
};

type InstallerRow = {
  id: string;
  name: string;
  company: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  sortOrder: number;
};

type InstallerCostRow = { installerId: string; itemId: string; cost: number };

const CALC_MODE_OPTIONS: { value: CalcMode; label: string; description: string }[] = [
  {
    value: "higher",
    label: "Higher of the two (recommended)",
    description:
      "Uses whichever of the flat % or per-item calculation comes out bigger.",
  },
  {
    value: "flat",
    label: "Flat % of Cabinets only",
    description: "Always Installation Base % of the pre-discount Cabinets total.",
  },
  {
    value: "perItem",
    label: "Per-item (Installers Price Table) only",
    description:
      "Always the sum of each catalog-linked line's assigned Installers Price Table row x qty.",
  },
];

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function costKey(installerId: string, itemId: string): string {
  return `${installerId}:${itemId}`;
}

export default function GmdParametersClient({
  initialParameters,
  initialSpecialCustomizationItems,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "cabinet-estimates" | "installation-calculation" | "version-updates"
  >("installation-calculation");

  const [settings, setSettings] = useState<Settings>(initialParameters.settings);
  const [installationTypes, setInstallationTypes] = useState<InstallationType[]>(
    initialParameters.installationTypes,
  );
  const [removalTypes, setRemovalTypes] = useState<RemovalType[]>(
    initialParameters.removalTypes,
  );
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>(
    initialParameters.projectTypes,
  );
  const [discountOptions, setDiscountOptions] = useState<DiscountOption[]>(
    initialParameters.discountOptions || [],
  );
  const [discountsExpanded, setDiscountsExpanded] = useState(false);
  const [discountForm, setDiscountForm] = useState<{
    id: string | null;
    percent: number;
    label: string;
    isActive: boolean;
  }>({ id: null, percent: 0, label: "", isActive: true });

  // Round 11: the real Installers Price Table - fetched separately from the
  // shared initialParameters bundle (which only carries active items, for
  // the estimate form's own use) since admin management needs to see and
  // reactivate inactive rows too, plus the installer list and cost matrix
  // that only this page ever needs.
  const [installationItems, setInstallationItems] = useState<InstallationItemRow[]>([]);
  const [installers, setInstallers] = useState<InstallerRow[]>([]);
  const [costsByKey, setCostsByKey] = useState<Record<string, number>>({});
  const [priceTableLoaded, setPriceTableLoaded] = useState(false);

  const [installationExpanded, setInstallationExpanded] = useState(false);
  const [typesExpanded, setTypesExpanded] = useState(false);
  const [removalTypesExpanded, setRemovalTypesExpanded] = useState(false);
  const [projectTypesExpanded, setProjectTypesExpanded] = useState(false);
  const [priceTableExpanded, setPriceTableExpanded] = useState(false);
  const [customizationExpanded, setCustomizationExpanded] = useState(false);
  const [specialCustomizationExpanded, setSpecialCustomizationExpanded] = useState(false);

  // Round 11 follow-up: Special Customization Items, moved in from the old
  // standalone Special Customization Settings page - same inline-edit-per-
  // row UX that page already had, just relocated under this tab.
  const [specialCustomizationItems, setSpecialCustomizationItems] = useState<
    SpecialCustomizationItem[]
  >(initialSpecialCustomizationItems);
  const [scSavingId, setScSavingId] = useState<string | null>(null);
  const [scDeletingId, setScDeletingId] = useState<string | null>(null);
  const [scCreating, setScCreating] = useState(false);
  const [newScName, setNewScName] = useState("");
  const [newScPrice, setNewScPrice] = useState(0);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [typeForm, setTypeForm] = useState<{
    id: string | null;
    name: string;
    description: string;
    multiplier: number;
    isActive: boolean;
  }>({ id: null, name: "", description: "", multiplier: 1, isActive: true });

  const [removalTypeForm, setRemovalTypeForm] = useState<{
    id: string | null;
    name: string;
    percent: number;
    isActive: boolean;
  }>({ id: null, name: "", percent: 0, isActive: true });

  const [projectTypeForm, setProjectTypeForm] = useState<{
    id: string | null;
    name: string;
    isActive: boolean;
  }>({ id: null, name: "", isActive: true });

  const [itemForm, setItemForm] = useState<{
    id: string | null;
    code: string;
    description: string;
    salePrice: number;
    isActive: boolean;
    bucketDefault: BucketDefault;
  }>({ id: null, code: "", description: "", salePrice: 0, isActive: true, bucketDefault: null });

  const [installerForm, setInstallerForm] = useState<{
    id: string | null;
    name: string;
    company: string;
    address: string;
    phone: string;
    email: string;
    isActive: boolean;
  }>({ id: null, name: "", company: "", address: "", phone: "", email: "", isActive: true });

  // Loaded lazily, the first time the Installers Price Table card is
  // opened, rather than on every page load - this page's other cards work
  // fine without it, and the cost matrix can get large.
  useEffect(() => {
    if (!priceTableExpanded || priceTableLoaded) return;
    (async () => {
      try {
        const [itemsRes, installersRes, costsRes] = await Promise.all([
          fetch("/api/cabinet-estimates/parameters/installation-items"),
          fetch("/api/cabinet-estimates/parameters/installers"),
          fetch("/api/cabinet-estimates/parameters/installer-costs"),
        ]);
        const [itemsJson, installersJson, costsJson] = await Promise.all([
          itemsRes.json(),
          installersRes.json(),
          costsRes.json(),
        ]);
        if (itemsRes.ok) setInstallationItems(itemsJson.installationItems || []);
        if (installersRes.ok) setInstallers(installersJson.installers || []);
        if (costsRes.ok) {
          const map: Record<string, number> = {};
          for (const row of costsJson.costs || []) {
            map[costKey(row.installerId, row.itemId)] = row.cost;
          }
          setCostsByKey(map);
        }
        setPriceTableLoaded(true);
      } catch {
        // non-fatal - card just shows empty until the admin retries by reopening it
      }
    })();
  }, [priceTableExpanded, priceTableLoaded]);

  function resetTypeForm() {
    setTypeForm({ id: null, name: "", description: "", multiplier: 1, isActive: true });
  }

  function editType(t: InstallationType) {
    setTypeForm({
      id: t.id,
      name: t.name,
      description: t.description || "",
      multiplier: t.multiplier,
      isActive: t.isActive,
    });
  }

  // Version Updates tab - program/table version history (see
  // cabinetProgramVersion.ts). Loaded the first time the tab is opened.
  const [versionInfo, setVersionInfo] = useState<{
    actual: string;
    public: string;
    log: {
      id: string;
      version: string;
      kind: string;
      note: string;
      hidden: boolean;
      createdByName: string;
      createdAt: string;
    }[];
  } | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionKind, setVersionKind] = useState<"major" | "minor" | "tables">("tables");
  const [versionNote, setVersionNote] = useState("");
  const [versionHidden, setVersionHidden] = useState(false);

  useEffect(() => {
    if (activeTab !== "version-updates" || versionInfo) return;
    let cancelled = false;
    (async () => {
      setVersionLoading(true);
      try {
        const res = await fetch("/api/cabinet-estimates/parameters/versions");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load versions");
        if (!cancelled) setVersionInfo(json);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load versions");
      } finally {
        if (!cancelled) setVersionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, versionInfo]);

  async function logVersionUpdate(event: FormEvent) {
    event.preventDefault();
    setSavingKey("versions");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cabinet-estimates/parameters/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: versionKind, note: versionNote, hidden: versionHidden }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to log update");
      setVersionInfo(json);
      setVersionNote("");
      setVersionHidden(false);
      setMessage(`Version updated to ${json.actual}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to log update");
    } finally {
      setSavingKey(null);
    }
  }

  function resetDiscountForm() {
    setDiscountForm({ id: null, percent: 0, label: "", isActive: true });
  }

  function editDiscount(d: DiscountOption) {
    setDiscountForm({ id: d.id, percent: d.percent, label: d.label, isActive: d.isActive });
  }

  async function saveDiscount(event: FormEvent) {
    event.preventDefault();
    setSavingKey("discounts");
    setMessage(null);
    setError(null);
    try {
      const payload = {
        percent: Math.trunc(discountForm.percent),
        label: discountForm.label.trim(),
        isActive: discountForm.isActive,
      };
      if (discountForm.id) {
        const res = await fetch(
          `/api/cabinet-estimates/parameters/discount-options/${discountForm.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to save");
        setDiscountOptions((prev) =>
          prev
            .map((d) => (d.id === discountForm.id ? json : d))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.percent - b.percent),
        );
      } else {
        const res = await fetch("/api/cabinet-estimates/parameters/discount-options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create");
        setDiscountOptions((prev) => [...prev, json]);
      }
      resetDiscountForm();
      setMessage("Discounts saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save discount");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleDiscountActive(d: DiscountOption) {
    setSavingKey("discounts");
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/parameters/discount-options/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !d.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setDiscountOptions((prev) => prev.map((x) => (x.id === d.id ? json : x)));
    } catch (err: any) {
      setError(err?.message || "Failed to update discount");
    } finally {
      setSavingKey(null);
    }
  }

  async function deleteDiscount(d: DiscountOption) {
    if (!window.confirm(`Permanently delete the ${d.percent}% discount option?`)) return;
    setSavingKey("discounts");
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/parameters/discount-options/${d.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete");
      setDiscountOptions((prev) => prev.filter((x) => x.id !== d.id));
      if (discountForm.id === d.id) resetDiscountForm();
      setMessage("Discount deleted.");
    } catch (err: any) {
      setError(err?.message || "Failed to delete discount");
    } finally {
      setSavingKey(null);
    }
  }

  function resetRemovalTypeForm() {
    setRemovalTypeForm({ id: null, name: "", percent: 0, isActive: true });
  }

  function editRemovalType(t: RemovalType) {
    setRemovalTypeForm({ id: t.id, name: t.name, percent: t.percent, isActive: t.isActive });
  }

  function resetProjectTypeForm() {
    setProjectTypeForm({ id: null, name: "", isActive: true });
  }

  function editProjectType(t: ProjectType) {
    setProjectTypeForm({ id: t.id, name: t.name, isActive: t.isActive });
  }

  function resetItemForm() {
    setItemForm({ id: null, code: "", description: "", salePrice: 0, isActive: true, bucketDefault: null });
  }

  function editItem(item: InstallationItemRow) {
    setItemForm({
      id: item.id,
      code: item.code || "",
      description: item.description,
      salePrice: item.salePrice,
      isActive: item.isActive,
      bucketDefault: item.bucketDefault,
    });
  }

  function resetInstallerForm() {
    setInstallerForm({ id: null, name: "", company: "", address: "", phone: "", email: "", isActive: true });
  }

  function editInstaller(installer: InstallerRow) {
    setInstallerForm({
      id: installer.id,
      name: installer.name,
      company: installer.company || "",
      address: installer.address || "",
      phone: installer.phone || "",
      email: installer.email || "",
      isActive: installer.isActive,
    });
  }

  async function saveInstallationFormula(event: FormEvent) {
    event.preventDefault();
    setSavingKey("installation-formula");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cabinet-estimates/parameters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationBasePercent: settings.installationBasePercent,
          installationCalcMode: settings.installationCalcMode,
          customSurchargePercent: settings.customSurchargePercent,
          costTaxPercent: settings.costTaxPercent,
        }),
      });
      if (!res.ok) {
        throw new Error((await res.json())?.error || "Failed to save Installation Formula");
      }
      setMessage("Installation Formula saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save Installation Formula");
    } finally {
      setSavingKey(null);
    }
  }

  function updateSpecialCustomizationItem(
    id: string,
    patch: Partial<SpecialCustomizationItem>,
  ) {
    setSpecialCustomizationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function saveSpecialCustomizationItem(item: SpecialCustomizationItem) {
    setScSavingId(item.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/special-customization-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          price: item.price,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save item");
      setMessage(`"${item.name}" saved.`);
    } catch (err: any) {
      setError(err?.message || "Failed to save item");
    } finally {
      setScSavingId(null);
    }
  }

  async function deleteSpecialCustomizationItem(item: SpecialCustomizationItem) {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    setScDeletingId(item.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/special-customization-items/${item.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete item");
      setSpecialCustomizationItems((prev) => prev.filter((i) => i.id !== item.id));
      setMessage(`"${item.name}" deleted.`);
    } catch (err: any) {
      setError(err?.message || "Failed to delete item");
    } finally {
      setScDeletingId(null);
    }
  }

  async function addSpecialCustomizationItem() {
    const name = newScName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setScCreating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cabinet-estimates/special-customization-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price: newScPrice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add item");
      setSpecialCustomizationItems((prev) => [...prev, json]);
      setNewScName("");
      setNewScPrice(0);
      setMessage(`"${name}" added.`);
    } catch (err: any) {
      setError(err?.message || "Failed to add item");
    } finally {
      setScCreating(false);
    }
  }

  async function saveCustomization(event: FormEvent) {
    event.preventDefault();
    setSavingKey("customization");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cabinet-estimates/parameters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationBasePercent: settings.installationBasePercent,
          installationCalcMode: settings.installationCalcMode,
          customSurchargePercent: settings.customSurchargePercent,
          costTaxPercent: settings.costTaxPercent,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to save");
      setMessage("Customization settings saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveType(event: FormEvent) {
    event.preventDefault();
    setSavingKey("installation-types");
    setMessage(null);
    setError(null);
    try {
      const name = typeForm.name.trim();
      if (!name) throw new Error("Name is required");
      if (typeForm.id) {
        const res = await fetch(
          `/api/cabinet-estimates/parameters/installation-types/${typeForm.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              description: typeForm.description,
              multiplier: typeForm.multiplier,
              isActive: typeForm.isActive,
            }),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to save");
        setInstallationTypes((prev) => prev.map((t) => (t.id === typeForm.id ? json : t)));
      } else {
        const res = await fetch("/api/cabinet-estimates/parameters/installation-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: typeForm.description,
            multiplier: typeForm.multiplier,
            isActive: typeForm.isActive,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create");
        setInstallationTypes((prev) => [...prev, json]);
      }
      resetTypeForm();
      setMessage("Installation Types saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save installation type");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleTypeActive(t: InstallationType) {
    setSavingKey("installation-types");
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/parameters/installation-types/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setInstallationTypes((prev) => prev.map((x) => (x.id === t.id ? json : x)));
    } catch (err: any) {
      setError(err?.message || "Failed to update installation type");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveRemovalType(event: FormEvent) {
    event.preventDefault();
    setSavingKey("removal-types");
    setMessage(null);
    setError(null);
    try {
      const name = removalTypeForm.name.trim();
      if (!name) throw new Error("Name is required");
      if (removalTypeForm.id) {
        const res = await fetch(
          `/api/cabinet-estimates/parameters/removal-types/${removalTypeForm.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              percent: removalTypeForm.percent,
              isActive: removalTypeForm.isActive,
            }),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to save");
        setRemovalTypes((prev) => prev.map((t) => (t.id === removalTypeForm.id ? json : t)));
      } else {
        const res = await fetch("/api/cabinet-estimates/parameters/removal-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            percent: removalTypeForm.percent,
            isActive: removalTypeForm.isActive,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create");
        setRemovalTypes((prev) => [...prev, json]);
      }
      resetRemovalTypeForm();
      setMessage("Removal Types saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save removal type");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleRemovalTypeActive(t: RemovalType) {
    setSavingKey("removal-types");
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/parameters/removal-types/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setRemovalTypes((prev) => prev.map((x) => (x.id === t.id ? json : x)));
    } catch (err: any) {
      setError(err?.message || "Failed to update removal type");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveProjectType(event: FormEvent) {
    event.preventDefault();
    setSavingKey("project-types");
    setMessage(null);
    setError(null);
    try {
      const name = projectTypeForm.name.trim();
      if (!name) throw new Error("Name is required");
      if (projectTypeForm.id) {
        const res = await fetch(
          `/api/cabinet-estimates/parameters/project-types/${projectTypeForm.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              isActive: projectTypeForm.isActive,
            }),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to save");
        setProjectTypes((prev) => prev.map((t) => (t.id === projectTypeForm.id ? json : t)));
      } else {
        const res = await fetch("/api/cabinet-estimates/parameters/project-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            isActive: projectTypeForm.isActive,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create");
        setProjectTypes((prev) => [...prev, json]);
      }
      resetProjectTypeForm();
      setMessage("Project Types saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save project type");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleProjectTypeActive(t: ProjectType) {
    setSavingKey("project-types");
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/parameters/project-types/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setProjectTypes((prev) => prev.map((x) => (x.id === t.id ? json : x)));
    } catch (err: any) {
      setError(err?.message || "Failed to update project type");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    setSavingKey("installation-items");
    setMessage(null);
    setError(null);
    try {
      const description = itemForm.description.trim();
      if (!description) throw new Error("Description is required");
      const body = {
        code: itemForm.code.trim() || null,
        description,
        salePrice: itemForm.salePrice,
        isActive: itemForm.isActive,
        bucketDefault: itemForm.bucketDefault,
      };
      if (itemForm.id) {
        const res = await fetch(
          `/api/cabinet-estimates/parameters/installation-items/${itemForm.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to save");
        setInstallationItems((prev) => prev.map((it) => (it.id === itemForm.id ? json : it)));
      } else {
        const res = await fetch("/api/cabinet-estimates/parameters/installation-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create");
        setInstallationItems((prev) => [...prev, json]);
      }
      resetItemForm();
      setMessage("Installers Price Table item saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save installation item");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleItemActive(item: InstallationItemRow) {
    setSavingKey("installation-items");
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/parameters/installation-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setInstallationItems((prev) => prev.map((it) => (it.id === item.id ? json : it)));
    } catch (err: any) {
      setError(err?.message || "Failed to update installation item");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveInstaller(event: FormEvent) {
    event.preventDefault();
    setSavingKey("installers");
    setMessage(null);
    setError(null);
    try {
      const name = installerForm.name.trim();
      if (!name) throw new Error("Name is required");
      const body = {
        name,
        company: installerForm.company.trim(),
        address: installerForm.address.trim(),
        phone: installerForm.phone.trim(),
        email: installerForm.email.trim(),
        isActive: installerForm.isActive,
      };
      if (installerForm.id) {
        const res = await fetch(
          `/api/cabinet-estimates/parameters/installers/${installerForm.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to save");
        setInstallers((prev) => prev.map((i) => (i.id === installerForm.id ? json : i)));
      } else {
        const res = await fetch("/api/cabinet-estimates/parameters/installers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create");
        setInstallers((prev) => [...prev, json]);
      }
      resetInstallerForm();
      setMessage("Installer saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save installer");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleInstallerActive(installer: InstallerRow) {
    setSavingKey("installers");
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/parameters/installers/${installer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !installer.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setInstallers((prev) => prev.map((i) => (i.id === installer.id ? json : i)));
    } catch (err: any) {
      setError(err?.message || "Failed to update installer");
    } finally {
      setSavingKey(null);
    }
  }

  function setCostCell(installerId: string, itemId: string, cost: number) {
    setCostsByKey((prev) => ({ ...prev, [costKey(installerId, itemId)]: cost }));
  }

  async function saveCosts() {
    setSavingKey("installer-costs");
    setMessage(null);
    setError(null);
    try {
      const costs: InstallerCostRow[] = [];
      for (const installer of installers) {
        for (const item of installationItems) {
          const key = costKey(installer.id, item.id);
          if (key in costsByKey) {
            costs.push({ installerId: installer.id, itemId: item.id, cost: costsByKey[key] });
          }
        }
      }
      const res = await fetch("/api/cabinet-estimates/parameters/installer-costs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setMessage("Installer costs saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save installer costs");
    } finally {
      setSavingKey(null);
    }
  }

  const inputClassName =
    "w-full max-w-[220px] rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900";

  const TABS: {
    id: "cabinet-estimates" | "installation-calculation" | "version-updates";
    label: string;
  }[] = [
    { id: "installation-calculation", label: "Installation Calculation" },
    { id: "cabinet-estimates", label: "Cabinet Estimates" },
    { id: "version-updates", label: "Version Updates" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GMD Parameters</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Tune the numbers behind the Cabinet Estimate program&apos;s auto-calculations.
          Standard estimate users never see or edit these directly - they only pick things,
          the program prices them.
        </p>
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

      <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                activeTab === tab.id
                  ? "bg-teal-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "installation-calculation" && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setInstallationExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Installation Formula
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Drives the estimate form&apos;s Installation total: Base Installation
                  (below) x the selected Installation Type&apos;s multiplier.
                </p>
              </div>
              {installationExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {installationExpanded && (
              <form onSubmit={saveInstallationFormula} className="space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium">Calculation Mode</label>
                  <div className="space-y-2">
                    {CALC_MODE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 p-2 dark:border-gray-700"
                      >
                        <input
                          type="radio"
                          name="calcMode"
                          checked={settings.installationCalcMode === opt.value}
                          onChange={() =>
                            setSettings((s) => ({ ...s, installationCalcMode: opt.value }))
                          }
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            {opt.label}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {opt.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Installation Base %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.installationBasePercent}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        installationBasePercent: toNumber(e.target.value),
                      }))
                    }
                    className={inputClassName}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Applied to the Cabinets total before discount.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingKey === "installation-formula"}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  Save Installation Formula
                </button>
              </form>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setTypesExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Installation Types
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The Standard / Special / Custom choice on the estimate form. Each
                  multiplies Base Installation.
                </p>
              </div>
              {typesExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {typesExpanded && (
              <>
                <form
                  onSubmit={saveType}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {typeForm.id ? "Edit Installation Type" : "Add Installation Type"}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Name
                      </label>
                      <input
                        value={typeForm.name}
                        onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Multiplier
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={typeForm.multiplier}
                        onChange={(e) =>
                          setTypeForm((f) => ({ ...f, multiplier: toNumber(e.target.value) }))
                        }
                        className={inputClassName}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={typeForm.isActive}
                          onChange={(e) =>
                            setTypeForm((f) => ({ ...f, isActive: e.target.checked }))
                          }
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                      Explanation (shown in the info pop-up next to Installation on the estimate)
                    </label>
                    <textarea
                      rows={3}
                      value={typeForm.description}
                      onChange={(e) =>
                        setTypeForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="e.g. Standard: regular install, no extra work needed."
                      className={inputClassName}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingKey === "installation-types"}
                      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {typeForm.id ? "Save Changes" : "Add Type"}
                    </button>
                    {typeForm.id && (
                      <button
                        type="button"
                        onClick={resetTypeForm}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Multiplier</th>
                        <th className="px-3 py-2 text-left">Explanation</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {installationTypes.map((t) => (
                        <tr key={t.id}>
                          <td className="px-3 py-2">{t.name}</td>
                          <td className="px-3 py-2">{t.multiplier}x</td>
                          <td className="max-w-xs px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                            {t.description?.trim() || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2">{t.isActive ? "Active" : "Inactive"}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => editType(t)}
                              className="mr-3 text-teal-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleTypeActive(t)}
                              className="text-gray-500 hover:underline"
                            >
                              {t.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setPriceTableExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Installers Price Table
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The real, item-by-item list vendor cabinet SKUs get AI/admin-assigned to
                  for installation pricing (Sale Price feeds the customer estimate). Per-
                  installer cost is internal bookkeeping only - it never affects an estimate.
                </p>
              </div>
              {priceTableExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {priceTableExpanded && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Installation Items
                  </h3>
                  <form
                    onSubmit={saveItem}
                    className="mb-3 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {itemForm.id ? "Edit Installation Item" : "Add Installation Item"}
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Code (optional)
                        </label>
                        <input
                          value={itemForm.code}
                          onChange={(e) => setItemForm((f) => ({ ...f, code: e.target.value }))}
                          className={inputClassName}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Description
                        </label>
                        <input
                          value={itemForm.description}
                          onChange={(e) =>
                            setItemForm((f) => ({ ...f, description: e.target.value }))
                          }
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Sale Price ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemForm.salePrice}
                          onChange={(e) =>
                            setItemForm((f) => ({ ...f, salePrice: toNumber(e.target.value) }))
                          }
                          className={inputClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Bucket Default
                        </label>
                        <select
                          value={itemForm.bucketDefault || ""}
                          onChange={(e) =>
                            setItemForm((f) => ({
                              ...f,
                              bucketDefault: (e.target.value || null) as BucketDefault,
                            }))
                          }
                          className={inputClassName}
                        >
                          <option value="">-- None --</option>
                          <option value="STANDARD">Standard</option>
                          <option value="DOUBLE">Double</option>
                          <option value="CUSTOM">Custom</option>
                          <option value="MISC">Misc</option>
                        </select>
                        <p className="mt-1 text-[11px] text-gray-400">
                          Every cabinet SKU in this bucket auto-assigns here - no AI guessing.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={itemForm.isActive}
                          onChange={(e) =>
                            setItemForm((f) => ({ ...f, isActive: e.target.checked }))
                          }
                        />
                        Active
                      </label>
                      <button
                        type="submit"
                        disabled={savingKey === "installation-items"}
                        className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {itemForm.id ? "Save Changes" : "Add Item"}
                      </button>
                      {itemForm.id && (
                        <button
                          type="button"
                          onClick={resetItemForm}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Sale Price</th>
                          <th className="px-3 py-2 text-left">Bucket Default</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {installationItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">{item.code || "-"}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">
                              {item.salePrice.toLocaleString("en-US", {
                                style: "currency",
                                currency: "USD",
                              })}
                            </td>
                            <td className="px-3 py-2">
                              {item.bucketDefault ? (
                                <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">
                                  {BUCKET_DEFAULT_LABELS[item.bucketDefault]}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{item.isActive ? "Active" : "Inactive"}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => editItem(item)}
                                className="mr-3 text-teal-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleItemActive(item)}
                                className="text-gray-500 hover:underline"
                              >
                                {item.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {installationItems.length === 0 && (
                          <tr>
                            <td className="px-3 py-4 text-center text-gray-400" colSpan={5}>
                              No installation items yet - add your first one above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Installers
                  </h3>
                  <form
                    onSubmit={saveInstaller}
                    className="mb-3 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {installerForm.id ? "Edit Installer" : "Add Installer"}
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Name
                        </label>
                        <input
                          value={installerForm.name}
                          onChange={(e) =>
                            setInstallerForm((f) => ({ ...f, name: e.target.value }))
                          }
                          className={inputClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Company
                        </label>
                        <input
                          value={installerForm.company}
                          onChange={(e) =>
                            setInstallerForm((f) => ({ ...f, company: e.target.value }))
                          }
                          className={inputClassName}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={installerForm.isActive}
                            onChange={(e) =>
                              setInstallerForm((f) => ({ ...f, isActive: e.target.checked }))
                            }
                          />
                          Active
                        </label>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Address
                        </label>
                        <input
                          value={installerForm.address}
                          onChange={(e) =>
                            setInstallerForm((f) => ({ ...f, address: e.target.value }))
                          }
                          className={inputClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Phone
                        </label>
                        <input
                          value={installerForm.phone}
                          onChange={(e) =>
                            setInstallerForm((f) => ({ ...f, phone: e.target.value }))
                          }
                          className={inputClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          Email
                        </label>
                        <input
                          value={installerForm.email}
                          onChange={(e) =>
                            setInstallerForm((f) => ({ ...f, email: e.target.value }))
                          }
                          className={inputClassName}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={savingKey === "installers"}
                        className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {installerForm.id ? "Save Changes" : "Add Installer"}
                      </button>
                      {installerForm.id && (
                        <button
                          type="button"
                          onClick={resetInstallerForm}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Company</th>
                          <th className="px-3 py-2 text-left">Address</th>
                          <th className="px-3 py-2 text-left">Phone</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {installers.map((installer) => (
                          <tr key={installer.id}>
                            <td className="px-3 py-2">{installer.name}</td>
                            <td className="px-3 py-2">{installer.company || "-"}</td>
                            <td className="px-3 py-2">{installer.address || "-"}</td>
                            <td className="px-3 py-2">{installer.phone || "-"}</td>
                            <td className="px-3 py-2">{installer.email || "-"}</td>
                            <td className="px-3 py-2">{installer.isActive ? "Active" : "Inactive"}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => editInstaller(installer)}
                                className="mr-3 text-teal-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleInstallerActive(installer)}
                                className="text-gray-500 hover:underline"
                              >
                                {installer.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {installers.length === 0 && (
                          <tr>
                            <td className="px-3 py-4 text-center text-gray-400" colSpan={7}>
                              No installers yet - add your first one above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Cost Matrix (internal only - never shown on an estimate)
                    </h3>
                    <button
                      type="button"
                      onClick={saveCosts}
                      disabled={savingKey === "installer-costs"}
                      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      Save Costs
                    </button>
                  </div>
                  {installationItems.length === 0 || installers.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      Add at least one installation item and one installer to fill in costs.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-left">Item</th>
                            {installers.map((installer) => (
                              <th key={installer.id} className="px-3 py-2 text-left">
                                {installer.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {installationItems.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.description}</td>
                              {installers.map((installer) => {
                                const key = costKey(installer.id, item.id);
                                return (
                                  <td key={installer.id} className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={costsByKey[key] ?? ""}
                                      placeholder="0.00"
                                      onChange={(e) =>
                                        setCostCell(installer.id, item.id, toNumber(e.target.value))
                                      }
                                      className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "cabinet-estimates" && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setCustomizationExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Customization
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The single surcharge % applied to Installation for every line item with
                  the Custom checkbox checked.
                </p>
              </div>
              {customizationExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {customizationExpanded && (
              <form
                onSubmit={saveCustomization}
                className="grid grid-cols-1 gap-4 md:max-w-[560px] md:grid-cols-2"
              >
                <div>
                  <label className="mb-1 block text-sm font-medium">Custom Surcharge %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.customSurchargePercent}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        customSurchargePercent: toNumber(e.target.value),
                      }))
                    }
                    className={inputClassName}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Of that line&apos;s own qty x unit price.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Preco de Custo tax %
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.costTaxPercent}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        costTaxPercent: toNumber(e.target.value),
                      }))
                    }
                    className={inputClassName}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Tax row of the cost-only view/print, applied to Cabinets (cost). 0 = not set.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={savingKey === "customization"}
                    className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Save Customization
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setSpecialCustomizationExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Special Customization Items
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The catalog of customization types and prices available on the Cabinet
                  Estimate form&apos;s Special Customization sidebar. Deactivate an item
                  instead of deleting it if it&apos;s already been used on a saved estimate.
                </p>
              </div>
              {specialCustomizationExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {specialCustomizationExpanded && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Add a new customization type
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[220px] flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Name
                      </label>
                      <input
                        value={newScName}
                        onChange={(e) => setNewScName(e.target.value)}
                        placeholder="e.g. Island Back Panel"
                        className={inputClassName}
                      />
                    </div>
                    <div className="w-32">
                      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Price
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={newScPrice}
                          onChange={(e) => setNewScPrice(Number(e.target.value) || 0)}
                          className={inputClassName}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addSpecialCustomizationItem}
                      disabled={scCreating}
                      className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" /> {scCreating ? "Adding..." : "Add Item"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="w-20 px-3 py-2 text-center">Sort</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="w-32 px-3 py-2 text-right">Price</th>
                        <th className="w-20 px-3 py-2 text-center">Active</th>
                        <th className="w-24 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {specialCustomizationItems.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-400" colSpan={5}>
                            No customization types yet - add one above.
                          </td>
                        </tr>
                      ) : (
                        specialCustomizationItems.map((item) => (
                          <tr key={item.id}>
                            <td className="p-1">
                              <input
                                type="number"
                                value={item.sortOrder}
                                onChange={(e) =>
                                  updateSpecialCustomizationItem(item.id, {
                                    sortOrder: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-full bg-transparent px-1.5 py-1 text-center text-sm text-gray-900 outline-none dark:text-gray-100"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                value={item.name}
                                onChange={(e) =>
                                  updateSpecialCustomizationItem(item.id, { name: e.target.value })
                                }
                                className="w-full bg-transparent px-1.5 py-1 text-sm text-gray-900 outline-none dark:text-gray-100"
                              />
                            </td>
                            <td className="p-1">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-sm text-gray-400">$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.price}
                                  onChange={(e) =>
                                    updateSpecialCustomizationItem(item.id, {
                                      price: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 bg-transparent px-1 py-1 text-right text-sm text-gray-900 outline-none dark:text-gray-100"
                                />
                              </div>
                            </td>
                            <td className="p-1 text-center">
                              <input
                                type="checkbox"
                                checked={item.isActive}
                                onChange={(e) =>
                                  updateSpecialCustomizationItem(item.id, {
                                    isActive: e.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-gray-600"
                              />
                            </td>
                            <td className="p-1">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveSpecialCustomizationItem(item)}
                                  disabled={scSavingId === item.id}
                                  className="inline-flex items-center justify-center rounded p-1.5 text-teal-600 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-teal-950/40"
                                  title="Save"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSpecialCustomizationItem(item)}
                                  disabled={scDeletingId === item.id}
                                  className="inline-flex items-center justify-center rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setDiscountsExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Discounts
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Choices for the Discount dropdown in the estimate&apos;s Total Summary. Each
                  is a percent of the Cabinets total. Add an optional label (e.g.
                  &quot;Contractor&quot;) to show a word instead of the percent. Saved estimates
                  keep the discount they were billed at; deactivate an option to hide it from
                  new estimates.
                </p>
              </div>
              {discountsExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {discountsExpanded && (
              <>
                <form
                  onSubmit={saveDiscount}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {discountForm.id ? "Edit Discount" : "Add Discount"}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Percent (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={discountForm.percent}
                        onChange={(e) =>
                          setDiscountForm((f) => ({ ...f, percent: toNumber(e.target.value) }))
                        }
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Label (optional)
                      </label>
                      <input
                        value={discountForm.label}
                        onChange={(e) =>
                          setDiscountForm((f) => ({ ...f, label: e.target.value }))
                        }
                        placeholder="e.g. Contractor"
                        className={inputClassName}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={discountForm.isActive}
                          onChange={(e) =>
                            setDiscountForm((f) => ({ ...f, isActive: e.target.checked }))
                          }
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingKey === "discounts"}
                      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {discountForm.id ? "Save Changes" : "Add Discount"}
                    </button>
                    {discountForm.id && (
                      <button
                        type="button"
                        onClick={resetDiscountForm}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Percent</th>
                        <th className="px-3 py-2 text-left">Shown as</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {discountOptions.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-400" colSpan={4}>
                            No discounts yet - add one above.
                          </td>
                        </tr>
                      ) : (
                        discountOptions.map((d) => (
                          <tr key={d.id}>
                            <td className="px-3 py-2">{d.percent}%</td>
                            <td className="px-3 py-2">{d.label.trim() || `${d.percent}%`}</td>
                            <td className="px-3 py-2">{d.isActive ? "Active" : "Inactive"}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => editDiscount(d)}
                                className="mr-3 text-teal-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleDiscountActive(d)}
                                className="mr-3 text-gray-500 hover:underline"
                              >
                                {d.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDiscount(d)}
                                className="text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setRemovalTypesExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Removal Types
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Options for the estimate header&apos;s Removal dropdown. Each type&apos;s
                  Percent is applied to the Cabinets total (before discounts) to compute the
                  Removal $ amount automatically - deactivate a type instead of it being
                  deleted if it&apos;s already been used on a saved estimate.
                </p>
              </div>
              {removalTypesExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {removalTypesExpanded && (
              <>
                <form
                  onSubmit={saveRemovalType}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {removalTypeForm.id ? "Edit Removal Type" : "Add Removal Type"}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Name
                      </label>
                      <input
                        value={removalTypeForm.name}
                        onChange={(e) =>
                          setRemovalTypeForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Percent (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={removalTypeForm.percent}
                        onChange={(e) =>
                          setRemovalTypeForm((f) => ({ ...f, percent: toNumber(e.target.value) }))
                        }
                        className={inputClassName}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={removalTypeForm.isActive}
                          onChange={(e) =>
                            setRemovalTypeForm((f) => ({ ...f, isActive: e.target.checked }))
                          }
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingKey === "removal-types"}
                      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {removalTypeForm.id ? "Save Changes" : "Add Type"}
                    </button>
                    {removalTypeForm.id && (
                      <button
                        type="button"
                        onClick={resetRemovalTypeForm}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Percent</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {removalTypes.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-400" colSpan={4}>
                            No removal types yet - add one above.
                          </td>
                        </tr>
                      ) : (
                        removalTypes.map((t) => (
                          <tr key={t.id}>
                            <td className="px-3 py-2">{t.name}</td>
                            <td className="px-3 py-2">{t.percent}%</td>
                            <td className="px-3 py-2">{t.isActive ? "Active" : "Inactive"}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => editRemovalType(t)}
                                className="mr-3 text-teal-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleRemovalTypeActive(t)}
                                className="text-gray-500 hover:underline"
                              >
                                {t.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setProjectTypesExpanded((p) => !p)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Project Types
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Options for the estimate header&apos;s Project Type dropdown. No
                  calculation is tied to this list yet - it&apos;s just the set of choices
                  available.
                </p>
              </div>
              {projectTypesExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {projectTypesExpanded && (
              <>
                <form
                  onSubmit={saveProjectType}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {projectTypeForm.id ? "Edit Project Type" : "Add Project Type"}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Name
                      </label>
                      <input
                        value={projectTypeForm.name}
                        onChange={(e) =>
                          setProjectTypeForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className={inputClassName}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={projectTypeForm.isActive}
                          onChange={(e) =>
                            setProjectTypeForm((f) => ({ ...f, isActive: e.target.checked }))
                          }
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingKey === "project-types"}
                      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {projectTypeForm.id ? "Save Changes" : "Add Type"}
                    </button>
                    {projectTypeForm.id && (
                      <button
                        type="button"
                        onClick={resetProjectTypeForm}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {projectTypes.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-400" colSpan={3}>
                            No project types yet - add one above.
                          </td>
                        </tr>
                      ) : (
                        projectTypes.map((t) => (
                          <tr key={t.id}>
                            <td className="px-3 py-2">{t.name}</td>
                            <td className="px-3 py-2">{t.isActive ? "Active" : "Inactive"}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => editProjectType(t)}
                                className="mr-3 text-teal-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleProjectTypeActive(t)}
                                className="text-gray-500 hover:underline"
                              >
                                {t.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {activeTab === "version-updates" && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Version Updates
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Format <strong>A.B.C</strong>: A = program version, B = update to the program,
                C = update to the tables (prices / new items). A bigger bump resets the digits to
                its right to 0. New and re-saved Cabinet Estimates are stamped with the current
                version automatically. Tick &quot;Don&apos;t show publicly&quot; to log an update
                that only admins see - everyone else keeps seeing the previous public version
                until the next public update.
              </p>
            </div>

            {versionLoading && !versionInfo ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : versionInfo ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
                      Actual version (admins)
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {versionInfo.actual}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
                      Public version (everyone else)
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {versionInfo.public}
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={logVersionUpdate}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Log an update
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        What changed
                      </label>
                      <select
                        value={versionKind}
                        onChange={(e) =>
                          setVersionKind(e.target.value as "major" | "minor" | "tables")
                        }
                        className={inputClassName}
                      >
                        <option value="tables">Tables / prices / new items (third digit)</option>
                        <option value="minor">Program update (second digit)</option>
                        <option value="major">New program version (first digit)</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                        Note (optional)
                      </label>
                      <input
                        value={versionNote}
                        onChange={(e) => setVersionNote(e.target.value)}
                        placeholder="e.g. Updated Jarlin price list"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={versionHidden}
                      onChange={(e) => setVersionHidden(e.target.checked)}
                    />
                    Don&apos;t show publicly (admins only see this change)
                  </label>
                  <button
                    type="submit"
                    disabled={savingKey === "versions"}
                    className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Log update
                  </button>
                </form>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Version</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Note</th>
                        <th className="px-3 py-2 text-left">Visibility</th>
                        <th className="px-3 py-2 text-left">By</th>
                        <th className="px-3 py-2 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {versionInfo.log.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3 py-2 font-semibold">{entry.version}</td>
                          <td className="px-3 py-2 capitalize">{entry.kind}</td>
                          <td className="px-3 py-2">{entry.note || "-"}</td>
                          <td className="px-3 py-2">{entry.hidden ? "Admins only" : "Public"}</td>
                          <td className="px-3 py-2">{entry.createdByName || "-"}</td>
                          <td className="px-3 py-2">
                            {new Date(entry.createdAt).toLocaleString("en-US")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
