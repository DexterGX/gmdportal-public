"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Edit,
  Hammer,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type CostTier = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

type InstallerProfile = {
  id: string;
  name: string;
  code: string | null;
  notes: string | null;
  costTierId: string | null;
  costTier: {
    id: string;
    key: string;
    name: string;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ItemCost = {
  id: string;
  itemId: string;
  costTierId: string;
  cost: string;
  costTier: {
    id: string;
    key: string;
    name: string;
  };
};

type InstallationItem = {
  id: string;
  code: string | null;
  description: string;
  category: string | null;
  defaultWillingToPay: string;
  salePrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  costs: ItemCost[];
};

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

type ProfileFormState = {
  id?: string;
  name: string;
  code: string;
  notes: string;
  costTierKey: string;
  isActive: boolean;
};

type ItemCostInput = {
  key: string;
  value: string;
};

type ItemFormState = {
  id?: string;
  code: string;
  description: string;
  category: string;
  defaultWillingToPay: string;
  salePrice: string;
  isActive: boolean;
  costs: ItemCostInput[];
};

type ItemSortKey =
  | "code"
  | "description"
  | "category"
  | "defaultWillingToPay"
  | "costA"
  | "costB"
  | "salePrice"
  | "status";

type SortDirection = "asc" | "desc";

const emptyProfileForm: ProfileFormState = {
  name: "",
  code: "",
  notes: "",
  costTierKey: "A",
  isActive: true,
};

const emptyItemFormTemplate: ItemFormState = {
  code: "",
  description: "",
  category: "",
  defaultWillingToPay: "",
  salePrice: "",
  isActive: true,
  costs: [
    { key: "A", value: "" },
    { key: "B", value: "" },
  ],
};

function createEmptyItemForm(): ItemFormState {
  return {
    ...emptyItemFormTemplate,
    costs: emptyItemFormTemplate.costs.map((entry) => ({ ...entry })),
  };
}

function validateItemForm(form: ItemFormState) {
  if (!form.description.trim()) {
    return "Item description is required.";
  }

  if (!form.defaultWillingToPay.trim()) {
    return "Default willing to pay is required.";
  }

  if (!form.salePrice.trim()) {
    return "Sale price is required.";
  }

  const costA = form.costs.find((entry) => entry.key === "A")?.value?.trim();
  const costB = form.costs.find((entry) => entry.key === "B")?.value?.trim();
  if (!costA || !costB) {
    return "Cost A and Cost B are required.";
  }

  return null;
}

function mapCostsByTier(form: ItemFormState) {
  const costsByTier: Record<string, string> = {};
  form.costs.forEach((entry) => {
    costsByTier[entry.key] = entry.value;
  });
  return costsByTier;
}

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function toSortedCosts(costs: ItemCostInput[]) {
  return [...costs]
    .filter((entry) => entry.key.trim())
    .sort((a, b) => a.key.localeCompare(b.key));
}

function getNextCostKey(existingKeys: string[]) {
  const normalized = new Set(existingKeys.map((key) => key.toUpperCase()));
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    if (!normalized.has(letter)) return letter;
  }
  return `X${existingKeys.length + 1}`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function CabinetInstallationClient({
  initialProfiles,
  initialCostTiers,
  initialItems,
}: {
  initialProfiles: InstallerProfile[];
  initialCostTiers: CostTier[];
  initialItems: InstallationItem[];
}) {
  const [profiles, setProfiles] = useState<InstallerProfile[]>(initialProfiles);
  const [costTiers, setCostTiers] = useState<CostTier[]>(initialCostTiers);
  const [items, setItems] = useState<InstallationItem[]>(initialItems);

  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [profileSearch, setProfileSearch] = useState("");
  const [profileActiveFilter, setProfileActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [search, setSearch] = useState("");
  const [selectedItemStatuses, setSelectedItemStatuses] = useState<string[]>(
    [],
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>("description");
  const [itemSortDirection, setItemSortDirection] =
    useState<SortDirection>("asc");

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isItemEditing, setIsItemEditing] = useState(false);
  const [profileForm, setProfileForm] =
    useState<ProfileFormState>(emptyProfileForm);
  const [itemForm, setItemForm] = useState<ItemFormState>(
    createEmptyItemForm(),
  );
  const [itemBatchForms, setItemBatchForms] = useState<ItemFormState[]>([]);
  const [message, setMessage] = useState<MessageState>(null);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.category?.trim() || "Uncategorized")
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const profileHasFilters = useMemo(
    () => profileSearch.trim().length > 0 || profileActiveFilter !== "all",
    [profileSearch, profileActiveFilter],
  );

  const itemHasFilters = useMemo(
    () =>
      search.trim().length > 0 ||
      selectedItemStatuses.length > 0 ||
      selectedCategories.length > 0,
    [search, selectedItemStatuses, selectedCategories],
  );

  const loadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const params = new URLSearchParams();
      if (profileSearch.trim()) params.set("search", profileSearch.trim());
      params.set("active", profileActiveFilter);

      const response = await fetch(
        `/api/settings/cabinet-installation/profiles?${params.toString()}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load installer profiles");
      }

      setProfiles(data.profiles || []);
      if (data.costTiers) {
        setCostTiers(data.costTiers);
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to load installer profiles.",
      });
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const loadItems = async () => {
    setIsLoadingItems(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(
        `/api/settings/cabinet-installation/items?${params.toString()}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to load cabinet installation items",
        );
      }

      setItems(data.items || []);
      if (data.costTiers) {
        setCostTiers(data.costTiers);
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to load cabinet installation items.",
      });
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadProfiles();
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileSearch, profileActiveFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadItems();
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const clearProfileFilters = () => {
    setProfileSearch("");
    setProfileActiveFilter("all");
  };

  const clearItemFilters = () => {
    setSearch("");
    setSelectedItemStatuses([]);
    setSelectedCategories([]);
  };

  const getCostByTierValue = (item: InstallationItem, tierKey: string) => {
    const found = item.costs.find((entry) => entry.costTier.key === tierKey);
    if (!found) return Number.NaN;
    return Number(found.cost);
  };

  const renderItemSortLabel = (key: ItemSortKey, label: string) => {
    if (itemSortKey !== key) return label;
    return `${label} ${itemSortDirection === "asc" ? "▲" : "▼"}`;
  };

  const handleItemSort = (key: ItemSortKey) => {
    setItemSortKey((currentKey) => {
      if (currentKey === key) {
        setItemSortDirection((direction) =>
          direction === "asc" ? "desc" : "asc",
        );
        return currentKey;
      }
      setItemSortDirection("asc");
      return key;
    });
  };

  const filteredAndSortedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const statusLabel = item.isActive ? "Active" : "Inactive";
      const categoryLabel = item.category?.trim() || "Uncategorized";

      if (
        selectedItemStatuses.length > 0 &&
        !selectedItemStatuses.includes(statusLabel)
      ) {
        return false;
      }

      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(categoryLabel)
      ) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((left, right) => {
      let leftValue: string | number = "";
      let rightValue: string | number = "";

      if (itemSortKey === "code") {
        leftValue = left.code || "";
        rightValue = right.code || "";
      } else if (itemSortKey === "description") {
        leftValue = left.description || "";
        rightValue = right.description || "";
      } else if (itemSortKey === "category") {
        leftValue = left.category || "Uncategorized";
        rightValue = right.category || "Uncategorized";
      } else if (itemSortKey === "defaultWillingToPay") {
        leftValue = Number(left.defaultWillingToPay);
        rightValue = Number(right.defaultWillingToPay);
      } else if (itemSortKey === "costA") {
        leftValue = getCostByTierValue(left, "A");
        rightValue = getCostByTierValue(right, "A");
      } else if (itemSortKey === "costB") {
        leftValue = getCostByTierValue(left, "B");
        rightValue = getCostByTierValue(right, "B");
      } else if (itemSortKey === "salePrice") {
        leftValue = Number(left.salePrice);
        rightValue = Number(right.salePrice);
      } else {
        leftValue = left.isActive ? "Active" : "Inactive";
        rightValue = right.isActive ? "Active" : "Inactive";
      }

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        const normalizedLeft = Number.isNaN(leftValue)
          ? Number.NEGATIVE_INFINITY
          : leftValue;
        const normalizedRight = Number.isNaN(rightValue)
          ? Number.NEGATIVE_INFINITY
          : rightValue;
        return itemSortDirection === "asc"
          ? normalizedLeft - normalizedRight
          : normalizedRight - normalizedLeft;
      }

      const comparison = String(leftValue).localeCompare(String(rightValue));
      return itemSortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    items,
    selectedItemStatuses,
    selectedCategories,
    itemSortKey,
    itemSortDirection,
  ]);

  const resetProfileForm = () => {
    setProfileForm(emptyProfileForm);
    setIsProfileEditing(false);
    setProfileModalOpen(false);
  };

  const resetItemForm = () => {
    setItemForm(createEmptyItemForm());
    setItemBatchForms([]);
    setIsItemEditing(false);
    setItemModalOpen(false);
  };

  const startEditProfile = (profile: InstallerProfile) => {
    setProfileForm({
      id: profile.id,
      name: profile.name,
      code: profile.code || "",
      notes: profile.notes || "",
      costTierKey: profile.costTier?.key || "A",
      isActive: profile.isActive,
    });
    setIsProfileEditing(true);
    setProfileModalOpen(true);
    setMessage(null);
  };

  const startEditItem = (item: InstallationItem) => {
    const tierCosts: ItemCostInput[] = item.costs.map((entry) => ({
      key: entry.costTier.key,
      value: String(entry.cost),
    }));

    const hasA = tierCosts.some((entry) => entry.key === "A");
    const hasB = tierCosts.some((entry) => entry.key === "B");
    if (!hasA) tierCosts.unshift({ key: "A", value: "" });
    if (!hasB) tierCosts.push({ key: "B", value: "" });

    setItemForm({
      id: item.id,
      code: item.code || "",
      description: item.description,
      category: item.category || "",
      defaultWillingToPay: String(item.defaultWillingToPay),
      salePrice: String(item.salePrice),
      isActive: item.isActive,
      costs: toSortedCosts(tierCosts),
    });
    setIsItemEditing(true);
    setItemModalOpen(true);
    setMessage(null);
  };

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!profileForm.name.trim()) {
      setMessage({
        type: "error",
        text: "Installer profile name is required.",
      });
      return;
    }

    if (!profileForm.costTierKey.trim()) {
      setMessage({
        type: "error",
        text: "Please select the profile cost tier.",
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const method = isProfileEditing ? "PATCH" : "POST";
      const response = await fetch(
        "/api/settings/cabinet-installation/profiles",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: profileForm.id,
            name: profileForm.name,
            code: profileForm.code || null,
            notes: profileForm.notes || null,
            costTierKey: profileForm.costTierKey,
            isActive: profileForm.isActive,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save installer profile");
      }

      setMessage({
        type: "success",
        text: isProfileEditing
          ? "Installer profile updated."
          : "Installer profile created.",
      });

      resetProfileForm();
      await Promise.all([loadProfiles(), loadItems()]);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save installer profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProfile = async (profile: InstallerProfile) => {
    if (!confirm(`Delete installer profile ${profile.name}?`)) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/settings/cabinet-installation/profiles",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: profile.id }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete installer profile");
      }

      setMessage({ type: "success", text: "Installer profile deleted." });
      await Promise.all([loadProfiles(), loadItems()]);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to delete installer profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const submitItem = async (event: React.FormEvent) => {
    event.preventDefault();

    const formsToSave = isItemEditing
      ? [itemForm]
      : [itemForm, ...itemBatchForms];

    for (let index = 0; index < formsToSave.length; index += 1) {
      const validationError = validateItemForm(formsToSave[index]);
      if (validationError) {
        if (isItemEditing) {
          setMessage({ type: "error", text: validationError });
        } else {
          setMessage({
            type: "error",
            text: `Item card ${index + 1}: ${validationError}`,
          });
        }
        return;
      }
    }

    if (!isItemEditing) {
      const repeatedCodes = new Set<string>();
      const seenCodes = new Set<string>();

      formsToSave.forEach((form) => {
        const normalizedCode = form.code.trim().toUpperCase();
        if (!normalizedCode) return;
        if (seenCodes.has(normalizedCode)) {
          repeatedCodes.add(normalizedCode);
          return;
        }
        seenCodes.add(normalizedCode);
      });

      if (repeatedCodes.size > 0) {
        setMessage({
          type: "error",
          text: `Item code already repeated in this form: ${Array.from(repeatedCodes).join(", ")}`,
        });
        return;
      }
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const method = isItemEditing ? "PATCH" : "POST";

      for (const form of formsToSave) {
        const response = await fetch(
          "/api/settings/cabinet-installation/items",
          {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: form.id,
              code: form.code || null,
              description: form.description,
              category: form.category || null,
              defaultWillingToPay: form.defaultWillingToPay,
              salePrice: form.salePrice,
              isActive: form.isActive,
              costsByTier: mapCostsByTier(form),
            }),
          },
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error || "Failed to save cabinet installation item",
          );
        }
      }

      setMessage({
        type: "success",
        text: isItemEditing
          ? "Installation item updated."
          : `${formsToSave.length} installation item${formsToSave.length === 1 ? "" : "s"} created.`,
      });

      resetItemForm();
      await loadItems();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save installation item.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (item: InstallationItem) => {
    if (!confirm(`Delete item ${item.description}?`)) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/cabinet-installation/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete installation item");
      }

      setMessage({ type: "success", text: "Installation item deleted." });
      await loadItems();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to delete installation item.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openNewProfile = () => {
    setProfileForm({
      ...emptyProfileForm,
      costTierKey: costTiers[0]?.key || "A",
    });
    setIsProfileEditing(false);
    setProfileModalOpen(true);
    setMessage(null);
  };

  const openNewItem = () => {
    setItemForm(createEmptyItemForm());
    setItemBatchForms([]);
    setIsItemEditing(false);
    setItemModalOpen(true);
    setMessage(null);
  };

  const addItemCard = () => {
    setItemBatchForms((prev) => [...prev, createEmptyItemForm()]);
    setMessage(null);
  };

  const removeBatchItem = (index: number) => {
    setItemBatchForms((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const updateBatchItemField = (
    index: number,
    field: keyof Omit<ItemFormState, "costs">,
    value: string | boolean | undefined,
  ) => {
    setItemBatchForms((prev) =>
      prev.map((form, itemIndex) =>
        itemIndex === index ? { ...form, [field]: value } : form,
      ),
    );
  };

  const addBatchCostTierInput = (index: number) => {
    setItemBatchForms((prev) =>
      prev.map((form, itemIndex) => {
        if (itemIndex !== index) return form;
        const nextKey = getNextCostKey(form.costs.map((entry) => entry.key));
        return {
          ...form,
          costs: toSortedCosts([...form.costs, { key: nextKey, value: "" }]),
        };
      }),
    );
  };

  const updateBatchCostValue = (index: number, key: string, value: string) => {
    setItemBatchForms((prev) =>
      prev.map((form, itemIndex) => {
        if (itemIndex !== index) return form;
        return {
          ...form,
          costs: form.costs.map((entry) =>
            entry.key === key ? { ...entry, value } : entry,
          ),
        };
      }),
    );
  };

  const removeBatchCostTierInput = (index: number, key: string) => {
    if (key === "A" || key === "B") return;
    setItemBatchForms((prev) =>
      prev.map((form, itemIndex) => {
        if (itemIndex !== index) return form;
        return {
          ...form,
          costs: form.costs.filter((entry) => entry.key !== key),
        };
      }),
    );
  };

  const renderItemCard = ({
    cardKey,
    form,
    title,
    onFieldChange,
    onCostChange,
    onAddCostTier,
    onRemoveCostTier,
    onRemoveCard,
  }: {
    cardKey?: string;
    form: ItemFormState;
    title: string;
    onFieldChange: (
      field: keyof Omit<ItemFormState, "costs">,
      value: string | boolean,
    ) => void;
    onCostChange: (key: string, value: string) => void;
    onAddCostTier: () => void;
    onRemoveCostTier: (key: string) => void;
    onRemoveCard?: () => void;
  }) => (
    <div
      key={cardKey}
      className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
        {onRemoveCard && (
          <button
            type="button"
            onClick={onRemoveCard}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Remove card
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Item Code
          </label>
          <input
            value={form.code}
            onChange={(event) => onFieldChange("code", event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            placeholder="e.g. CAB-INST-01"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category
          </label>
          <input
            value={form.category}
            onChange={(event) => onFieldChange("category", event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            placeholder="e.g. Cabinets Installation"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <input
            value={form.description}
            onChange={(event) =>
              onFieldChange("description", event.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            placeholder="e.g. Cabinets Base and Wall"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default Willing To Pay
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.defaultWillingToPay}
              onChange={(event) =>
                onFieldChange("defaultWillingToPay", event.target.value)
              }
              className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sale Price
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.salePrice}
              onChange={(event) =>
                onFieldChange("salePrice", event.target.value)
              }
              className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              placeholder="0.00"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 self-end">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              onFieldChange("isActive", event.target.checked)
            }
          />
          Active
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Hammer className="w-4 h-4" />
            <h5 className="font-medium">Costs By Tier</h5>
          </div>
          <button
            type="button"
            onClick={onAddCostTier}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Cost Tier
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Cost A and Cost B are required. You can add more tiers if needed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {toSortedCosts(form.costs).map((entry) => (
            <div key={entry.key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                Cost {entry.key}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.value}
                    onChange={(event) =>
                      onCostChange(entry.key, event.target.value)
                    }
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                    placeholder="0.00"
                  />
                </div>
                {entry.key !== "A" && entry.key !== "B" && (
                  <button
                    type="button"
                    onClick={() => onRemoveCostTier(entry.key)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const addCostTierInput = () => {
    setItemForm((prev) => {
      const nextKey = getNextCostKey(prev.costs.map((entry) => entry.key));
      return {
        ...prev,
        costs: toSortedCosts([...prev.costs, { key: nextKey, value: "" }]),
      };
    });
  };

  const removeCostTierInput = (key: string) => {
    if (key === "A" || key === "B") return;
    setItemForm((prev) => ({
      ...prev,
      costs: prev.costs.filter((entry) => entry.key !== key),
    }));
  };

  const getCostByTier = (item: InstallationItem, tierKey: string) => {
    const found = item.costs.find((entry) => entry.costTier.key === tierKey);
    return found ? formatMoney(found.cost) : "-";
  };

  const exportProfiles = () => {
    const rows: (string | number)[][] = [
      ["Name", "Code", "Cost Tier", "Notes", "Status"],
      ...profiles.map((profile) => [
        profile.name,
        profile.code || "",
        profile.costTier?.name || "",
        profile.notes || "",
        profile.isActive ? "Active" : "Inactive",
      ]),
    ];

    downloadCsv("cabinet_installer_profiles.csv", rows);
  };

  const exportItems = () => {
    const rows: (string | number)[][] = [
      [
        "Code",
        "Description",
        "Category",
        "Default Willing To Pay",
        "Cost A",
        "Cost B",
        "Sale Price",
        "Status",
      ],
      ...items.map((item) => [
        item.code || "",
        item.description,
        item.category || "",
        Number(item.defaultWillingToPay),
        getCostByTier(item, "A"),
        getCostByTier(item, "B"),
        Number(item.salePrice),
        item.isActive ? "Active" : "Inactive",
      ]),
    ];

    downloadCsv("cabinet_installation_items.csv", rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Cabinet Installation
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
            Configure installer profiles and installation pricing items used to
            build cabinet estimate totals automatically in future estimate
            workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openNewProfile}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <UserCog className="w-4 h-4" />
            Add Profile
          </button>
          <button
            type="button"
            onClick={openNewItem}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Installation Item
          </button>
        </div>
      </div>

      {message && !itemModalOpen && !profileModalOpen && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Installer Profiles
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                type="button"
                onClick={exportProfiles}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={profileSearch}
                onChange={(event) => setProfileSearch(event.target.value)}
                placeholder="Search profile name or code..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              />
            </div>
            <select
              value={profileActiveFilter}
              onChange={(event) =>
                setProfileActiveFilter(
                  event.target.value as "all" | "active" | "inactive",
                )
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
            <button
              type="button"
              onClick={clearProfileFilters}
              disabled={!profileHasFilters}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Profile</th>
                  <th className="px-4 py-3 text-left font-medium">Cost Tier</th>
                  <th className="px-4 py-3 text-left font-medium">Notes</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoadingProfiles ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      Loading installer profiles...
                    </td>
                  </tr>
                ) : profiles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No installer profiles found.
                    </td>
                  </tr>
                ) : (
                  profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-700/20"
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        <div className="font-medium">{profile.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {profile.code || "No code"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {profile.costTier?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-md">
                        {profile.notes || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            profile.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {profile.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEditProfile(profile)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProfile(profile)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
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
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Installation Price List
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                type="button"
                onClick={exportItems}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code, description, category..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              />
            </div>

            <FilterMultiSelect
              label="Status"
              options={["Active", "Inactive"]}
              selected={selectedItemStatuses}
              onChange={setSelectedItemStatuses}
              fullWidth
              matchInputStyle
            />

            <FilterMultiSelect
              label="Category"
              options={categoryOptions}
              selected={selectedCategories}
              onChange={setSelectedCategories}
              fullWidth
              matchInputStyle
            />
          </div>

          <button
            type="button"
            onClick={clearItemFilters}
            disabled={!itemHasFilters}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
          >
            Clear filters
          </button>
        </div>

        <div className="md:hidden p-3 space-y-3">
          {isLoadingItems ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              Loading installation items...
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No installation items found for current filters.
            </div>
          ) : (
            filteredAndSortedItems.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-base">
                      {item.description}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.code || "No code"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Category
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {item.category || "Uncategorized"}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Default willing to pay
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatMoney(item.defaultWillingToPay)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                      Cost A
                    </p>
                    <p className="font-semibold text-indigo-700 dark:text-indigo-300">
                      {getCostByTier(item, "A")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
                    <p className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      Cost B
                    </p>
                    <p className="font-semibold text-blue-700 dark:text-blue-300">
                      {getCostByTier(item, "B")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                      Sale price
                    </p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatMoney(item.salePrice)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => startEditItem(item)}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 pt-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item)}
                    className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600 pt-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("code")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel("code", "Code")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("description")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel("description", "Description")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("category")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel("category", "Category")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("defaultWillingToPay")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel(
                        "defaultWillingToPay",
                        "Default Willing To Pay",
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("costA")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel("costA", "Cost A")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("costB")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel("costB", "Cost B")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("salePrice")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel("salePrice", "Sale Price")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleItemSort("status")}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      {renderItemSortLabel("status", "Status")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoadingItems ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      Loading installation items...
                    </td>
                  </tr>
                ) : filteredAndSortedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No installation items found for current filters.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-700/20"
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {item.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {item.category || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {formatMoney(item.defaultWillingToPay)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {getCostByTier(item, "A")}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {getCostByTier(item, "B")}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {formatMoney(item.salePrice)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            item.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
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
      </div>

      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isProfileEditing
                  ? "Edit Installer Profile"
                  : "Add Installer Profile"}
              </h3>
              <button
                type="button"
                onClick={resetProfileForm}
                className="p-1 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitProfile} className="px-6 py-5 space-y-4">
              {message && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    message.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Profile Name
                </label>
                <input
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  placeholder="e.g. Procraft Team"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Profile Code
                </label>
                <input
                  value={profileForm.code}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      code: event.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  placeholder="e.g. PROC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cost Tier
                </label>
                <select
                  value={profileForm.costTierKey}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      costTierKey: event.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                >
                  {costTiers.map((tier) => (
                    <option key={tier.id} value={tier.key}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={profileForm.notes}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={profileForm.isActive}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active
              </label>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={resetProfileForm}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isItemEditing
                  ? "Edit Installation Item"
                  : "Add Installation Item"}
              </h3>
              <button
                type="button"
                onClick={resetItemForm}
                className="p-1 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitItem} className="px-6 py-5 space-y-4">
              {message && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    message.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              )}

              {renderItemCard({
                cardKey: isItemEditing
                  ? "installation-item-edit"
                  : "installation-item-1",
                form: itemForm,
                title: isItemEditing
                  ? "Installation Item"
                  : "Installation Item 1",
                onFieldChange: (field, value) =>
                  setItemForm((prev) => ({ ...prev, [field]: value })),
                onCostChange: (key, value) =>
                  setItemForm((prev) => ({
                    ...prev,
                    costs: prev.costs.map((entry) =>
                      entry.key === key ? { ...entry, value } : entry,
                    ),
                  })),
                onAddCostTier: addCostTierInput,
                onRemoveCostTier: removeCostTierInput,
              })}

              {!isItemEditing &&
                itemBatchForms.map((batchItem, index) =>
                  renderItemCard({
                    cardKey: `installation-item-${index + 2}`,
                    form: batchItem,
                    title: `Installation Item ${index + 2}`,
                    onFieldChange: (field, value) =>
                      updateBatchItemField(index, field, value),
                    onCostChange: (key, value) =>
                      updateBatchCostValue(index, key, value),
                    onAddCostTier: () => addBatchCostTierInput(index),
                    onRemoveCostTier: (key) =>
                      removeBatchCostTierInput(index, key),
                    onRemoveCard: () => removeBatchItem(index),
                  }),
                )}

              {!isItemEditing && (
                <button
                  type="button"
                  onClick={addItemCard}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  Add another item card
                </button>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={resetItemForm}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {isSaving
                    ? "Saving..."
                    : isItemEditing
                      ? "Save item"
                      : `Save all items (${itemBatchForms.length + 1})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
