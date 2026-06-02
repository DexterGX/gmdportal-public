"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  X,
} from "lucide-react";

type BaseItem = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

type RoomItem = BaseItem;
type LedTypeItem = BaseItem & {
  minimumPriceUnder25Ft: number;
  pricePerFt: number;
};
type ControlTypeItem = BaseItem & { unitPrice: number };
type ProfileItem = BaseItem & { unitPrice: number; groovePricePerFt: number };
type SheetTypeItem = BaseItem & { minimumPrice: number; unitPrice: number };
type MirrorColorItem = BaseItem & { venda: number; custo: number };
type GlassDoorShelfTypeItem = BaseItem & { venda: number; custo: number };
type IslandPanelModelItem = BaseItem & {
  sfPerBox: number;
  cost: number;
  salesPrice: number;
  link: string | null;
  imageUrl: string | null;
};
type MirrorFrameFinishItem = BaseItem & { pricePerLinearFt: number };
type MirrorBevelOptionItem = BaseItem & { venda: number; custo: number };
type MirrorSetting = {
  cuttingFee: number;
  outletCost: number;
  outletSale: number;
  lightCutoutCost: number;
  lightCutoutSale: number;
  outOfSquareBeveledCost: number;
  outOfSquareBeveledSale: number;
  removalPricePerSqFt: number;
  repairWallMultiplier: number;
};
type WallUnitSetting = {
  constructionPricePerSqFt: number;
};
type MirrorFrameSetting = {
  minimumCharge: number;
  paintingFactor: number;
};

type ProgramNote = {
  id: string;
  title: string;
  content: string;
  catalogUrl: string | null;
  createdAt: string;
};

type GroupKey =
  | "rooms"
  | "types"
  | "control-types"
  | "profiles"
  | "sheet-types"
  | "mirror-colors"
  | "glass-door-shelf-types"
  | "island-panel-models"
  | "mirror-frame-finishes"
  | "mirror-bevel-options";
type MiscSectionKey =
  | "LED_STRIP"
  | "LED_SHEET"
  | "MIRROR"
  | "GLASS_DOOR_SHELF"
  | "ISLAND_PANEL"
  | "WALL_UNIT"
  | "MIRROR_FRAME";

interface Props {
  initialRooms: RoomItem[];
  initialLedTypes: LedTypeItem[];
  initialControlTypes: ControlTypeItem[];
  initialProfiles: ProfileItem[];
  initialSheetTypes: SheetTypeItem[];
  initialMirrorColors: MirrorColorItem[];
  initialGlassDoorShelfTypes: GlassDoorShelfTypeItem[];
  initialIslandPanelModels: IslandPanelModelItem[];
  initialMirrorFrameFinishes: MirrorFrameFinishItem[];
  initialMirrorBevelOptions: MirrorBevelOptionItem[];
  initialMirrorSetting: MirrorSetting;
  initialWallUnitSetting: WallUnitSetting;
  initialMirrorFrameSetting: MirrorFrameSetting;
  initialProgramNotes: ProgramNote[];
  initialSheetMinPrice: number;
}

const MISC_SECTIONS: Array<{ key: MiscSectionKey; label: string }> = [
  { key: "LED_STRIP", label: "LED Strip" },
  { key: "LED_SHEET", label: "LED Sheet" },
  { key: "MIRROR", label: "Mirror" },
  { key: "GLASS_DOOR_SHELF", label: "Glass Door/Shelf" },
  { key: "ISLAND_PANEL", label: "Island Panel" },
  { key: "WALL_UNIT", label: "Wall Unit" },
  { key: "MIRROR_FRAME", label: "Mirror Frame" },
];

const GROUPS: Array<{ key: GroupKey; label: string; endpoint: string }> = [
  {
    key: "rooms",
    label: "Rooms",
    endpoint: "/api/misc-estimates/settings/led/rooms",
  },
  {
    key: "types",
    label: "LED Types",
    endpoint: "/api/misc-estimates/settings/led/types",
  },
  {
    key: "control-types",
    label: "Control Types",
    endpoint: "/api/misc-estimates/settings/led/control-types",
  },
  {
    key: "profiles",
    label: "Profiles",
    endpoint: "/api/misc-estimates/settings/led/profiles",
  },
  {
    key: "sheet-types",
    label: "Sheet Types",
    endpoint: "/api/misc-estimates/settings/led/sheet-types",
  },
  {
    key: "mirror-colors",
    label: "Mirror Colors",
    endpoint: "/api/misc-estimates/settings/mirror/colors",
  },
  {
    key: "glass-door-shelf-types",
    label: "Glass Types",
    endpoint: "/api/misc-estimates/settings/glass-door-shelf/types",
  },
  {
    key: "island-panel-models",
    label: "Panel Models",
    endpoint: "/api/misc-estimates/settings/island-panel/models",
  },
  {
    key: "mirror-frame-finishes",
    label: "Mirror Frame Finishes",
    endpoint: "/api/misc-estimates/settings/mirror-frame/finishes",
  },
  {
    key: "mirror-bevel-options",
    label: "Mirror Bevel Options",
    endpoint: "/api/misc-estimates/settings/mirror/bevel-options",
  },
];

export default function MiscLedSettingsClient({
  initialRooms,
  initialLedTypes,
  initialControlTypes,
  initialProfiles,
  initialSheetTypes,
  initialMirrorColors,
  initialGlassDoorShelfTypes,
  initialIslandPanelModels,
  initialMirrorFrameFinishes,
  initialMirrorBevelOptions,
  initialMirrorSetting,
  initialWallUnitSetting,
  initialMirrorFrameSetting,
  initialProgramNotes,
  initialSheetMinPrice,
}: Props) {
  const [activeSection, setActiveSection] =
    useState<MiscSectionKey>("LED_STRIP");
  const [rooms, setRooms] = useState<RoomItem[]>(initialRooms);
  const [ledTypes, setLedTypes] = useState<LedTypeItem[]>(initialLedTypes);
  const [controlTypes, setControlTypes] =
    useState<ControlTypeItem[]>(initialControlTypes);
  const [profiles, setProfiles] = useState<ProfileItem[]>(initialProfiles);
  const [sheetTypes, setSheetTypes] =
    useState<SheetTypeItem[]>(initialSheetTypes);
  const [mirrorColors, setMirrorColors] =
    useState<MirrorColorItem[]>(initialMirrorColors);
  const [glassDoorShelfTypes, setGlassDoorShelfTypes] = useState<
    GlassDoorShelfTypeItem[]
  >(initialGlassDoorShelfTypes);
  const [islandPanelModels, setIslandPanelModels] = useState<
    IslandPanelModelItem[]
  >(initialIslandPanelModels);
  const [mirrorFrameFinishes, setMirrorFrameFinishes] = useState<
    MirrorFrameFinishItem[]
  >(initialMirrorFrameFinishes);
  const [mirrorBevelOptions, setMirrorBevelOptions] = useState<
    MirrorBevelOptionItem[]
  >(initialMirrorBevelOptions);
  const [mirrorSetting, setMirrorSetting] =
    useState<MirrorSetting>(initialMirrorSetting);
  const [wallUnitSetting, setWallUnitSetting] = useState<WallUnitSetting>(
    initialWallUnitSetting,
  );
  const [mirrorFrameSetting, setMirrorFrameSetting] =
    useState<MirrorFrameSetting>(initialMirrorFrameSetting);
  const [isProgramNotesOpen, setIsProgramNotesOpen] = useState(false);
  const [programNotes, setProgramNotes] =
    useState<ProgramNote[]>(initialProgramNotes);
  const [expandedProgramNoteId, setExpandedProgramNoteId] = useState<
    string | null
  >(initialProgramNotes[0]?.id ?? null);
  const [isAddProgramNoteOpen, setIsAddProgramNoteOpen] = useState(false);
  const [programNoteTitle, setProgramNoteTitle] = useState("");
  const [programNoteContent, setProgramNoteContent] = useState("");
  const [programNoteCatalogUrl, setProgramNoteCatalogUrl] = useState("");
  const [savingProgramNote, setSavingProgramNote] = useState(false);
  const [deletingProgramNoteId, setDeletingProgramNoteId] = useState<
    string | null
  >(null);
  const [programNoteError, setProgramNoteError] = useState<string | null>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [price, setPrice] = useState("0");
  const [groovePricePerFt, setGroovePricePerFt] = useState("0");
  const [minimumPrice, setMinimumPrice] = useState("0");
  const [mirrorVenda, setMirrorVenda] = useState("0");
  const [mirrorCusto, setMirrorCusto] = useState("0");
  const [sfPerBox, setSfPerBox] = useState("0");
  const [itemCost, setItemCost] = useState("0");
  const [salesPrice, setSalesPrice] = useState("0");
  const [itemLink, setItemLink] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [pricePerLinearFt, setPricePerLinearFt] = useState("0");
  const [active, setActive] = useState(true);
  const [savingKey, setSavingKey] = useState<GroupKey | null>(null);
  const [wallUnitFormulaExpanded, setWallUnitFormulaExpanded] = useState(false);
  const [mirrorFrameFormulaExpanded, setMirrorFrameFormulaExpanded] =
    useState(false);
  const [expandedGroups, setExpandedGroups] = useState<
    Record<GroupKey, boolean>
  >({
    rooms: false,
    types: false,
    "control-types": false,
    profiles: false,
    "sheet-types": false,
    "mirror-colors": false,
    "glass-door-shelf-types": false,
    "island-panel-models": false,
    "mirror-frame-finishes": false,
    "mirror-bevel-options": false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collections = useMemo(
    () => ({
      rooms,
      types: ledTypes,
      "control-types": controlTypes,
      profiles,
      "sheet-types": sheetTypes,
      "mirror-colors": mirrorColors,
      "glass-door-shelf-types": glassDoorShelfTypes,
      "island-panel-models": islandPanelModels,
      "mirror-frame-finishes": mirrorFrameFinishes,
      "mirror-bevel-options": mirrorBevelOptions,
    }),
    [
      rooms,
      ledTypes,
      controlTypes,
      profiles,
      sheetTypes,
      mirrorColors,
      glassDoorShelfTypes,
      islandPanelModels,
      mirrorFrameFinishes,
      mirrorBevelOptions,
    ],
  );

  function resetForm() {
    setEditingKey(null);
    setName("");
    setSortOrder("0");
    setPrice("0");
    setGroovePricePerFt("0");
    setMinimumPrice("0");
    setMirrorVenda("0");
    setMirrorCusto("0");
    setSfPerBox("0");
    setItemCost("0");
    setSalesPrice("0");
    setItemLink("");
    setItemImageUrl("");
    setPricePerLinearFt("0");
    setActive(true);
    setError(null);
  }

  function startEdit(groupKey: GroupKey, item: any) {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: true }));
    setEditingKey(`${groupKey}:${item.id}`);
    setName(item.name || "");
    setSortOrder(String(item.sortOrder ?? 0));
    setPrice(String(item.pricePerFt ?? item.unitPrice ?? 0));
    setGroovePricePerFt(String(item.groovePricePerFt ?? 0));
    setMinimumPrice(String(item.minimumPriceUnder25Ft ?? 0));
    setMirrorVenda(String(item.venda ?? 0));
    setMirrorCusto(String(item.custo ?? 0));
    setSfPerBox(String(item.sfPerBox ?? 0));
    setItemCost(String(item.cost ?? 0));
    setSalesPrice(String(item.salesPrice ?? 0));
    setItemLink(item.link ?? "");
    setItemImageUrl(item.imageUrl ?? "");
    setPricePerLinearFt(String(item.pricePerLinearFt ?? 0));
    if (groupKey === "sheet-types") {
      setMinimumPrice(String(item.minimumPrice ?? 0));
    }
    setActive(Boolean(item.active));
    setMessage(null);
    setError(null);
  }

  function setGroupItems(groupKey: GroupKey, items: any[]) {
    if (groupKey === "rooms") {
      setRooms(items as RoomItem[]);
      return;
    }
    if (groupKey === "types") {
      setLedTypes(items as LedTypeItem[]);
      return;
    }
    if (groupKey === "control-types") {
      setControlTypes(items as ControlTypeItem[]);
      return;
    }
    if (groupKey === "sheet-types") {
      setSheetTypes(items as SheetTypeItem[]);
      return;
    }
    if (groupKey === "mirror-colors") {
      setMirrorColors(items as MirrorColorItem[]);
      return;
    }
    if (groupKey === "glass-door-shelf-types") {
      setGlassDoorShelfTypes(items as GlassDoorShelfTypeItem[]);
      return;
    }
    if (groupKey === "island-panel-models") {
      setIslandPanelModels(items as IslandPanelModelItem[]);
      return;
    }
    if (groupKey === "mirror-frame-finishes") {
      setMirrorFrameFinishes(items as MirrorFrameFinishItem[]);
      return;
    }
    if (groupKey === "mirror-bevel-options") {
      setMirrorBevelOptions(items as MirrorBevelOptionItem[]);
      return;
    }
    setProfiles(items as ProfileItem[]);
  }

  async function saveItem(event: FormEvent, groupKey: GroupKey) {
    event.preventDefault();
    setSavingKey(groupKey);
    setMessage(null);
    setError(null);

    try {
      if (!name.trim()) {
        throw new Error("Name is required.");
      }

      const group = GROUPS.find((item) => item.key === groupKey)!;
      const currentItems = collections[groupKey];
      const currentId = editingKey?.startsWith(`${groupKey}:`)
        ? editingKey.split(":")[1]
        : null;

      const body: any = {
        id: currentId || undefined,
        name: name.trim(),
        sortOrder: Number(sortOrder || 0),
        active,
      };

      if (groupKey === "types") {
        body.minimumPriceUnder25Ft = Number(minimumPrice || 0);
        body.pricePerFt = Number(price || 0);
      }
      if (groupKey === "sheet-types") {
        body.minimumPrice = Number(minimumPrice || 0);
      }

      if (
        groupKey === "mirror-colors" ||
        groupKey === "glass-door-shelf-types" ||
        groupKey === "mirror-bevel-options"
      ) {
        body.venda = Number(mirrorVenda || 0);
        body.custo = Number(mirrorCusto || 0);
      }

      if (
        groupKey === "control-types" ||
        groupKey === "profiles" ||
        groupKey === "sheet-types"
      ) {
        body.unitPrice = Number(price || 0);
      }
      if (groupKey === "profiles") {
        body.groovePricePerFt = Number(groovePricePerFt || 0);
      }
      if (groupKey === "island-panel-models") {
        body.sfPerBox = Number(sfPerBox || 0);
        body.cost = Number(itemCost || 0);
        body.salesPrice = Number(salesPrice || 0);
        body.link = itemLink.trim() || null;
        body.imageUrl = itemImageUrl.trim() || null;
      }
      if (groupKey === "mirror-frame-finishes") {
        body.pricePerLinearFt = Number(pricePerLinearFt || 0);
      }

      const response = await fetch(group.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to save item");
      }

      if (currentId) {
        setGroupItems(
          groupKey,
          currentItems.map((item: any) =>
            item.id === currentId ? json : item,
          ),
        );
        setMessage("Updated successfully.");
      } else {
        setGroupItems(groupKey, [...currentItems, json]);
        setMessage("Created successfully.");
      }

      resetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to save item");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleStatus(
    groupKey: GroupKey,
    item: any,
    targetActive: boolean,
  ) {
    setSavingKey(groupKey);
    setMessage(null);
    setError(null);
    try {
      const group = GROUPS.find((entry) => entry.key === groupKey)!;
      const currentItems = collections[groupKey];
      const response = await fetch(group.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          action: targetActive ? "activate" : "deactivate",
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to change status");
      }

      setGroupItems(
        groupKey,
        currentItems.map((entry: any) => (entry.id === item.id ? json : entry)),
      );
      setMessage(targetActive ? "Activated." : "Deactivated.");
    } catch (err: any) {
      setError(err?.message || "Failed to change status");
    } finally {
      setSavingKey(null);
    }
  }

  async function deleteItem(groupKey: GroupKey, item: any) {
    setSavingKey(groupKey);
    setMessage(null);
    setError(null);
    try {
      const group = GROUPS.find((entry) => entry.key === groupKey)!;
      const currentItems = collections[groupKey];
      const response = await fetch(group.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "delete" }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to delete item");
      }

      setGroupItems(
        groupKey,
        currentItems.filter((entry: any) => entry.id !== item.id),
      );
      setMessage("Deleted successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to delete item");
    } finally {
      setSavingKey(null);
    }
  }

  function renderCollectionSection(groupKey: GroupKey) {
    const group = GROUPS.find((item) => item.key === groupKey)!;
    const items = [...collections[groupKey]].sort((a: any, b: any) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
    const isEditingGroup = editingKey?.startsWith(`${groupKey}:`) ?? false;
    const showPrice =
      groupKey !== "rooms" &&
      groupKey !== "island-panel-models" &&
      groupKey !== "mirror-frame-finishes";
    const showGroovePrice = groupKey === "profiles";
    const showMinimumPrice = groupKey === "types" || groupKey === "sheet-types";
    const showSfPerBox = groupKey === "island-panel-models";
    const showItemCost = groupKey === "island-panel-models";
    const showSalesPrice = groupKey === "island-panel-models";
    const showLink = groupKey === "island-panel-models";
    const showImageUrl = groupKey === "island-panel-models";
    const showPricePerLinearFt = groupKey === "mirror-frame-finishes";
    const showMirrorPrices =
      groupKey === "mirror-colors" ||
      groupKey === "glass-door-shelf-types" ||
      groupKey === "mirror-bevel-options";
    const priceLabel =
      groupKey === "types"
        ? "Extra Price Per Ft Over 25"
        : groupKey === "sheet-types"
          ? "Price Per Sq Ft"
          : groupKey === "mirror-colors"
            ? "Sale Price (Venda)"
            : groupKey === "glass-door-shelf-types"
              ? "Sale Price (Venda)"
              : groupKey === "mirror-bevel-options"
                ? "Price Per Inch (Venda)"
                : groupKey === "island-panel-models"
                  ? "Sales Price"
                  : groupKey === "mirror-frame-finishes"
                    ? "Price Per Linear Ft"
                    : groupKey === "profiles"
                      ? "Profile Price"
                      : "Unit Price";
    const minimumPriceLabel =
      groupKey === "types" ? "Minimum Price Under 25 Ft" : "Minimum Price";
    const singularLabel =
      group.label === "LED Types"
        ? "LED Type"
        : group.label === "Sheet Types"
          ? "Sheet Type"
          : group.label.endsWith("s")
            ? group.label.slice(0, -1)
            : group.label;
    const isExpanded = expandedGroups[groupKey];

    return (
      <section
        key={groupKey}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <button
          type="button"
          onClick={() =>
            setExpandedGroups((prev) => ({
              ...prev,
              [groupKey]: !prev[groupKey],
            }))
          }
          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {group.label}
            </h2>
            {groupKey === "types" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Up to 25 ft uses the minimum price. Above 25 ft, each extra foot
                adds the extra price per foot.
              </p>
            )}
            {groupKey === "sheet-types" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Subtotal uses max(Minimum Price, Price Per Sq Ft x rounded
                Sq.Ft).
              </p>
            )}
            {groupKey === "mirror-colors" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Mirror subtotal uses selected color sale price.
              </p>
            )}
            {groupKey === "mirror-bevel-options" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Selected option applies price per inch in the Mirror subtotal.
              </p>
            )}
            {groupKey === "glass-door-shelf-types" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used by the Glass Door/Shelf section as the selected glass type.
              </p>
            )}
            {groupKey === "island-panel-models" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used by Island / Wall Decorative Panel for Box Qty and subtotal.
              </p>
            )}
            {groupKey === "mirror-frame-finishes" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used by Mirror Frame subtotal as the finish price per linear ft.
              </p>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {isExpanded && (
          <>
            <form
              onSubmit={(event) => void saveItem(event, groupKey)}
              className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {isEditingGroup
                  ? `Edit ${singularLabel}`
                  : `New ${singularLabel}`}
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-5">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>

                {showMinimumPrice && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {minimumPriceLabel}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={minimumPrice}
                      onChange={(event) => setMinimumPrice(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showPrice && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {priceLabel}
                    </label>
                    {showMirrorPrices ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mirrorVenda}
                        onChange={(event) => setMirrorVenda(event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                      />
                    )}
                  </div>
                )}

                {showMirrorPrices && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Cost Price (Custo)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={mirrorCusto}
                      onChange={(event) => setMirrorCusto(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showSfPerBox && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      SF Per Box
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sfPerBox}
                      onChange={(event) => setSfPerBox(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showItemCost && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Cost
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemCost}
                      onChange={(event) => setItemCost(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showSalesPrice && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Sales Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={salesPrice}
                      onChange={(event) => setSalesPrice(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showPricePerLinearFt && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Price Per Linear Ft
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerLinearFt}
                      onChange={(event) =>
                        setPricePerLinearFt(event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showLink && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Link (optional)
                    </label>
                    <input
                      value={itemLink}
                      onChange={(event) => setItemLink(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showImageUrl && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Image URL (optional)
                    </label>
                    <input
                      value={itemImageUrl}
                      onChange={(event) => setItemImageUrl(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                {showGroovePrice && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Groove Price Per Ft
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={groovePricePerFt}
                      onChange={(event) =>
                        setGroovePricePerFt(event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setActive(event.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingKey === groupKey}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {isEditingGroup ? "Save Changes" : `Add ${singularLabel}`}
                </button>
                {isEditingGroup && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 dark:border-gray-600"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                    <th className="py-2 pr-4">Name</th>
                    {showMinimumPrice && (
                      <th className="py-2 pr-4">{minimumPriceLabel}</th>
                    )}
                    {showPrice && <th className="py-2 pr-4">{priceLabel}</th>}
                    {showMirrorPrices && (
                      <th className="py-2 pr-4">Cost Price (Custo)</th>
                    )}
                    {showSfPerBox && <th className="py-2 pr-4">SF/Box</th>}
                    {showItemCost && <th className="py-2 pr-4">Cost</th>}
                    {showSalesPrice && (
                      <th className="py-2 pr-4">Sales Price</th>
                    )}
                    {showPricePerLinearFt && (
                      <th className="py-2 pr-4">Price Per Linear Ft</th>
                    )}
                    {showLink && <th className="py-2 pr-4">Link</th>}
                    {showImageUrl && <th className="py-2 pr-4">Image URL</th>}
                    {showGroovePrice && (
                      <th className="py-2 pr-4">Groove Price Per Ft</th>
                    )}
                    <th className="py-2 pr-4">Sort</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="py-4 text-sm text-gray-500 dark:text-gray-400"
                      >
                        No entries yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any) => (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 dark:border-gray-700/60"
                      >
                        <td className="py-2 pr-4">{item.name}</td>
                        {showMinimumPrice && (
                          <td className="py-2 pr-4">
                            {Number(
                              item.minimumPriceUnder25Ft ??
                                item.minimumPrice ??
                                0,
                            ).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })}
                          </td>
                        )}
                        {showPrice && (
                          <td className="py-2 pr-4">
                            {Number(
                              showMirrorPrices
                                ? item.venda
                                : (item.pricePerFt ?? item.unitPrice ?? 0),
                            ).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })}
                          </td>
                        )}
                        {showMirrorPrices && (
                          <td className="py-2 pr-4">
                            {Number(item.custo ?? 0).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })}
                          </td>
                        )}
                        {showSfPerBox && (
                          <td className="py-2 pr-4">
                            {Number(item.sfPerBox ?? 0)}
                          </td>
                        )}
                        {showItemCost && (
                          <td className="py-2 pr-4">
                            {Number(item.cost ?? 0).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })}
                          </td>
                        )}
                        {showSalesPrice && (
                          <td className="py-2 pr-4">
                            {Number(item.salesPrice ?? 0).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                              },
                            )}
                          </td>
                        )}
                        {showPricePerLinearFt && (
                          <td className="py-2 pr-4">
                            {Number(item.pricePerLinearFt ?? 0).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                              },
                            )}
                          </td>
                        )}
                        {showLink && (
                          <td className="py-2 pr-4">
                            {item.link ? (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {item.link}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                        )}
                        {showImageUrl && (
                          <td className="py-2 pr-4">{item.imageUrl || "-"}</td>
                        )}
                        {showGroovePrice && (
                          <td className="py-2 pr-4">
                            {Number(item.groovePricePerFt ?? 0).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                              },
                            )}
                          </td>
                        )}
                        <td className="py-2 pr-4">{item.sortOrder}</td>
                        <td className="py-2 pr-4">
                          {item.active ? "Yes" : "No"}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => startEdit(groupKey, item)}
                            className="mr-3 text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void toggleStatus(groupKey, item, !item.active)
                            }
                            className={
                              item.active
                                ? "text-red-600 hover:underline"
                                : "text-green-600 hover:underline"
                            }
                          >
                            {item.active ? "Deactivate" : "Activate"}
                          </button>
                          {(groupKey === "rooms" ||
                            groupKey === "mirror-colors" ||
                            groupKey === "glass-door-shelf-types" ||
                            groupKey === "island-panel-models" ||
                            groupKey === "mirror-frame-finishes" ||
                            groupKey === "mirror-bevel-options") && (
                            <button
                              type="button"
                              onClick={() => void deleteItem(groupKey, item)}
                              className="ml-3 text-red-700 hover:underline"
                            >
                              Delete
                            </button>
                          )}
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
    );
  }

  async function saveMirrorSetting(event: FormEvent) {
    event.preventDefault();
    setSavingKey("mirror-colors");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/misc-estimates/settings/mirror/formula",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mirrorSetting),
        },
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to save mirror settings");
      }

      setMirrorSetting({
        cuttingFee: Number(json.cuttingFee ?? 0),
        outletCost: Number(json.outletCost ?? 0),
        outletSale: Number(json.outletSale ?? 0),
        lightCutoutCost: Number(json.lightCutoutCost ?? 0),
        lightCutoutSale: Number(json.lightCutoutSale ?? 0),
        outOfSquareBeveledCost: Number(json.outOfSquareBeveledCost ?? 0),
        outOfSquareBeveledSale: Number(json.outOfSquareBeveledSale ?? 0),
        removalPricePerSqFt: Number(json.removalPricePerSqFt ?? 0),
        repairWallMultiplier: Number(json.repairWallMultiplier ?? 0.7),
      });
      setMessage("Mirror formula settings saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save mirror settings");
    } finally {
      setSavingKey(null);
    }
  }

  function renderMirrorFormulaSection() {
    const inputClassName =
      "w-full max-w-[260px] rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900";

    return (
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Mirror Formula Values
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Used by Mirror and Mirror Removal subtotal formulas.
          </p>
        </div>

        <form
          onSubmit={(event) => void saveMirrorSetting(event)}
          className="grid grid-cols-1 gap-4 md:max-w-[560px] md:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">
              Cutting Fee
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.cuttingFee}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  cuttingFee: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Outlet Cost
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.outletCost}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  outletCost: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Outlet Sale
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.outletSale}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  outletSale: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Light Cutout Cost
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.lightCutoutCost}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  lightCutoutCost: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Light Cutout Sale
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.lightCutoutSale}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  lightCutoutSale: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Out Of Square Beveled Cost
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.outOfSquareBeveledCost}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  outOfSquareBeveledCost: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Out Of Square Beveled Sale
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.outOfSquareBeveledSale}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  outOfSquareBeveledSale: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Removal Price Per Sq Ft
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.removalPricePerSqFt}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  removalPricePerSqFt: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Repair Wall Multiplier
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={mirrorSetting.repairWallMultiplier}
              onChange={(event) =>
                setMirrorSetting((prev) => ({
                  ...prev,
                  repairWallMultiplier: Number(event.target.value || 0),
                }))
              }
              className={inputClassName}
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingKey === "mirror-colors"}
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save Mirror Formula
            </button>
          </div>
        </form>
      </section>
    );
  }

  async function saveWallUnitSetting(event: FormEvent) {
    event.preventDefault();
    setSavingKey("rooms");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/misc-estimates/settings/wall-unit/formula",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wallUnitSetting),
        },
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to save wall unit settings");
      }

      setWallUnitSetting({
        constructionPricePerSqFt: Number(json.constructionPricePerSqFt ?? 0),
      });
      setMessage("Wall unit settings saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save wall unit settings");
    } finally {
      setSavingKey(null);
    }
  }

  function renderWallUnitFormulaSection() {
    const inputClassName =
      "w-full max-w-[260px] rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900";

    return (
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setWallUnitFormulaExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Wall Unit Formula Values
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Used by Wall Unit subtotal: Sq.Ft x Construction Price Per Sq Ft.
            </p>
          </div>
          {wallUnitFormulaExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {wallUnitFormulaExpanded && (
          <form
            onSubmit={(event) => void saveWallUnitSetting(event)}
            className="grid grid-cols-1 gap-4 md:max-w-[560px] md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Construction Price Per Sq Ft
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={wallUnitSetting.constructionPricePerSqFt}
                onChange={(event) =>
                  setWallUnitSetting({
                    constructionPricePerSqFt: Number(event.target.value || 0),
                  })
                }
                className={inputClassName}
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={savingKey === "rooms"}
                className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Save Wall Unit Formula
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  async function saveMirrorFrameSetting(event: FormEvent) {
    event.preventDefault();
    setSavingKey("mirror-frame-finishes");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/misc-estimates/settings/mirror-frame/formula",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mirrorFrameSetting),
        },
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to save mirror frame settings");
      }

      setMirrorFrameSetting({
        minimumCharge: Number(json.minimumCharge ?? 0),
        paintingFactor: Number(json.paintingFactor ?? 1),
      });
      setMessage("Mirror frame settings saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save mirror frame settings");
    } finally {
      setSavingKey(null);
    }
  }

  function renderMirrorFrameFormulaSection() {
    const inputClassName =
      "w-full max-w-[260px] rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900";

    return (
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setMirrorFrameFormulaExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Mirror Frame Formula Values
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Minimum charge and painting factor used by Mirror Frame subtotal.
            </p>
          </div>
          {mirrorFrameFormulaExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {mirrorFrameFormulaExpanded && (
          <form
            onSubmit={(event) => void saveMirrorFrameSetting(event)}
            className="grid grid-cols-1 gap-4 md:max-w-[560px] md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Minimum Charge
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mirrorFrameSetting.minimumCharge}
                onChange={(event) =>
                  setMirrorFrameSetting((prev) => ({
                    ...prev,
                    minimumCharge: Number(event.target.value || 0),
                  }))
                }
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Painting Factor
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mirrorFrameSetting.paintingFactor}
                onChange={(event) =>
                  setMirrorFrameSetting((prev) => ({
                    ...prev,
                    paintingFactor: Number(event.target.value || 1),
                  }))
                }
                className={inputClassName}
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={savingKey === "mirror-frame-finishes"}
                className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Save Mirror Frame Formula
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  async function createProgramNote() {
    const title = programNoteTitle.trim();
    const content = programNoteContent.trim();
    const catalogUrl = programNoteCatalogUrl.trim();

    if (!title || !content) {
      setProgramNoteError("Title and content are required.");
      return;
    }

    setSavingProgramNote(true);
    setProgramNoteError(null);

    try {
      const response = await fetch("/api/misc-estimates/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          catalogUrl: catalogUrl || null,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to save note");
      }

      setProgramNotes((prev) => [...prev, json.note]);
      setExpandedProgramNoteId(json.note.id);
      setProgramNoteTitle("");
      setProgramNoteContent("");
      setProgramNoteCatalogUrl("");
      setIsAddProgramNoteOpen(false);
      setMessage("Program note saved.");
      setError(null);
    } catch (err: any) {
      setProgramNoteError(err?.message || "Failed to save note.");
    } finally {
      setSavingProgramNote(false);
    }
  }

  async function deleteProgramNote(noteId: string) {
    setDeletingProgramNoteId(noteId);
    setProgramNoteError(null);

    try {
      const response = await fetch("/api/misc-estimates/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to delete note");
      }

      setProgramNotes((prev) => prev.filter((note) => note.id !== noteId));
      if (expandedProgramNoteId === noteId) {
        setExpandedProgramNoteId(null);
      }
      setMessage("Program note deleted.");
      setError(null);
    } catch (err: any) {
      setProgramNoteError(err?.message || "Failed to delete note.");
    } finally {
      setDeletingProgramNoteId(null);
    }
  }

  function renderProgramNotesSection() {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsProgramNotesOpen(true)}
          className="h-10 w-10 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-700 inline-flex items-center justify-center transition-colors"
          title="Important notes"
          aria-label="Open important notes"
        >
          <AlertTriangle className="h-5 w-5" />
        </button>

        {isProgramNotesOpen && (
          <div
            className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setIsProgramNotesOpen(false)}
          >
            <div
              className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Program Notes
                </h2>
                <button
                  type="button"
                  onClick={() => setIsProgramNotesOpen(false)}
                  className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-64px)]">
                {!isAddProgramNoteOpen && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setProgramNoteError(null);
                        setIsAddProgramNoteOpen(true);
                      }}
                      className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Add note
                    </button>
                  </div>
                )}

                {isAddProgramNoteOpen && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Add Note
                    </p>
                    <input
                      type="text"
                      value={programNoteTitle}
                      onChange={(event) =>
                        setProgramNoteTitle(event.target.value)
                      }
                      placeholder="Note title"
                      className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm"
                    />
                    <textarea
                      value={programNoteContent}
                      onChange={(event) =>
                        setProgramNoteContent(event.target.value)
                      }
                      placeholder="Note content"
                      rows={4}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                    <input
                      type="url"
                      value={programNoteCatalogUrl}
                      onChange={(event) =>
                        setProgramNoteCatalogUrl(event.target.value)
                      }
                      placeholder="Catalogue link (optional, https://...)"
                      className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm"
                    />
                    {programNoteError ? (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {programNoteError}
                      </p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddProgramNoteOpen(false);
                          setProgramNoteError(null);
                        }}
                        className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void createProgramNote()}
                        disabled={savingProgramNote}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingProgramNote ? "Saving..." : "Save note"}
                      </button>
                    </div>
                  </div>
                )}

                {programNotes.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No notes added yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {programNotes.map((note) => {
                      const isExpanded = expandedProgramNoteId === note.id;
                      return (
                        <div
                          key={note.id}
                          className="rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProgramNoteId((prev) =>
                                prev === note.id ? null : note.id,
                              )
                            }
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            {note.title}
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              <p>{note.content}</p>
                              {note.catalogUrl ? (
                                <a
                                  href={note.catalogUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex mt-2 items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                  Open link
                                </a>
                              ) : null}
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteProgramNote(note.id)
                                  }
                                  disabled={deletingProgramNoteId === note.id}
                                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  {deletingProgramNoteId === note.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {new Date(note.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Misc Estimate Settings</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Configure miscellaneous estimate pricing by section.
          </p>
        </div>
        <div className="pt-1">{renderProgramNotesSection()}</div>
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
          {MISC_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                setActiveSection(section.key);
                resetForm();
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                activeSection === section.key
                  ? "bg-teal-600 text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "LED_STRIP" ? (
        <div className="space-y-6">
          {renderCollectionSection("rooms")}
          {renderCollectionSection("types")}
          {renderCollectionSection("control-types")}
          {renderCollectionSection("profiles")}
        </div>
      ) : activeSection === "LED_SHEET" ? (
        <div className="space-y-6">
          {renderCollectionSection("rooms")}
          {renderCollectionSection("sheet-types")}
          {renderCollectionSection("control-types")}
        </div>
      ) : activeSection === "MIRROR" ? (
        <div className="space-y-6">
          {renderCollectionSection("rooms")}
          {renderCollectionSection("mirror-colors")}
          {renderCollectionSection("mirror-bevel-options")}
          {renderMirrorFormulaSection()}
        </div>
      ) : activeSection === "GLASS_DOOR_SHELF" ? (
        <div className="space-y-6">
          {renderCollectionSection("glass-door-shelf-types")}
        </div>
      ) : activeSection === "ISLAND_PANEL" ? (
        <div className="space-y-6">
          {renderCollectionSection("rooms")}
          {renderCollectionSection("island-panel-models")}
        </div>
      ) : activeSection === "WALL_UNIT" ? (
        <div className="space-y-6">
          {renderCollectionSection("rooms")}
          {renderWallUnitFormulaSection()}
        </div>
      ) : activeSection === "MIRROR_FRAME" ? (
        <div className="space-y-6">
          {renderCollectionSection("rooms")}
          {renderCollectionSection("mirror-frame-finishes")}
          {renderMirrorFrameFormulaSection()}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Settings for{" "}
          {MISC_SECTIONS.find((item) => item.key === activeSection)?.label} are
          not configured yet.
        </div>
      )}
    </div>
  );
}
