"use client";

import { FormEvent, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Save } from "lucide-react";

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

type GroupKey = "rooms" | "types" | "control-types" | "profiles";
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
];

export default function MiscLedSettingsClient({
  initialRooms,
  initialLedTypes,
  initialControlTypes,
  initialProfiles,
}: Props) {
  const [activeSection, setActiveSection] =
    useState<MiscSectionKey>("LED_STRIP");
  const [rooms, setRooms] = useState<RoomItem[]>(initialRooms);
  const [ledTypes, setLedTypes] = useState<LedTypeItem[]>(initialLedTypes);
  const [controlTypes, setControlTypes] =
    useState<ControlTypeItem[]>(initialControlTypes);
  const [profiles, setProfiles] = useState<ProfileItem[]>(initialProfiles);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [price, setPrice] = useState("0");
  const [groovePricePerFt, setGroovePricePerFt] = useState("0");
  const [minimumPrice, setMinimumPrice] = useState("0");
  const [active, setActive] = useState(true);
  const [savingKey, setSavingKey] = useState<GroupKey | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<
    Record<GroupKey, boolean>
  >({
    rooms: false,
    types: false,
    "control-types": false,
    profiles: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collections = useMemo(
    () => ({
      rooms,
      types: ledTypes,
      "control-types": controlTypes,
      profiles,
    }),
    [rooms, ledTypes, controlTypes, profiles],
  );

  function resetForm() {
    setEditingKey(null);
    setName("");
    setSortOrder("0");
    setPrice("0");
    setGroovePricePerFt("0");
    setMinimumPrice("0");
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

      if (groupKey === "control-types" || groupKey === "profiles") {
        body.unitPrice = Number(price || 0);
      }
      if (groupKey === "profiles") {
        body.groovePricePerFt = Number(groovePricePerFt || 0);
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

  function renderCollectionSection(groupKey: GroupKey) {
    const group = GROUPS.find((item) => item.key === groupKey)!;
    const items = [...collections[groupKey]].sort((a: any, b: any) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
    const isEditingGroup = editingKey?.startsWith(`${groupKey}:`) ?? false;
    const showPrice = groupKey !== "rooms";
    const showGroovePrice = groupKey === "profiles";
    const showMinimumPrice = groupKey === "types";
    const priceLabel =
      groupKey === "types"
        ? "Extra Price Per Ft Over 25"
        : groupKey === "profiles"
          ? "Profile Price"
          : "Unit Price";
    const singularLabel =
      group.label === "LED Types"
        ? "LED Type"
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
                      Minimum Price Under 25 Ft
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
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
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
                      <th className="py-2 pr-4">Minimum Under 25 Ft</th>
                    )}
                    {showPrice && <th className="py-2 pr-4">{priceLabel}</th>}
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
                        colSpan={
                          showMinimumPrice
                            ? 6
                            : showGroovePrice
                              ? 6
                              : showPrice
                                ? 5
                                : 4
                        }
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
                              item.minimumPriceUnder25Ft ?? 0,
                            ).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })}
                          </td>
                        )}
                        {showPrice && (
                          <td className="py-2 pr-4">
                            {Number(
                              item.pricePerFt ?? item.unitPrice ?? 0,
                            ).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })}
                          </td>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Misc Estimate Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Configure miscellaneous estimate pricing by section.
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
