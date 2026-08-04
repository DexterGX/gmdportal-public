// Shared config for all Fabrication Order settings lookup lists.
// Every lookup table shares the same shape (name, one numeric value, active, sortOrder)
// except for small per-category differences (edge types have a build-up flag,
// slab types use a multiplier instead of a flat price). This config drives both
// the generic API route and the settings UI so we don't repeat near-identical
// CRUD code ten times.

export type FabricationSettingsCategory =
  | "edgeTypes"
  | "slabTypes"
  | "sinkCutouts"
  | "cooktopCutouts"
  | "bumpOut"
  | "cuttingBoard"
  | "windowsill"
  | "powerStation"
  | "otherCharges"
  | "removal";

export interface FabricationSettingsCategoryConfig {
  category: FabricationSettingsCategory;
  label: string;
  description: string;
  modelKey: string; // property name on the Prisma client
  dbField: string; // the numeric field name in the database
  valueLabel: string; // human label for the numeric field
  valuePrefix?: string; // e.g. "$"
  valueSuffix?: string; // e.g. "/ sqft"
  hasBuildUpFlag?: boolean; // only Edge Types
  entityType: string; // label used in the price change log
}

export const FABRICATION_SETTINGS_CATEGORIES: FabricationSettingsCategoryConfig[] = [
  {
    category: "edgeTypes",
    label: "Edge Types",
    description:
      "Drives the Labor rate. Priced per sqft of the job. Mark an entry as Build-Up if it should price a build-up section instead of the main labor rate.",
    modelKey: "fabricationEdgeType",
    dbField: "pricePerSqft",
    valueLabel: "Price",
    valuePrefix: "$",
    valueSuffix: "/ sqft",
    hasBuildUpFlag: true,
    entityType: "EdgeType",
  },
  {
    category: "slabTypes",
    label: "Slab Types",
    description:
      "Solid vs. Vein (or other stone types). The multiplier is applied on top of the Labor and Build-Up rate.",
    modelKey: "fabricationSlabTypeOption",
    dbField: "multiplier",
    valueLabel: "Multiplier",
    valueSuffix: "x",
    entityType: "SlabType",
  },
  {
    category: "sinkCutouts",
    label: "Sink Cutout Options",
    description: "Flat price per cutout, multiplied by quantity on the order.",
    modelKey: "fabricationSinkCutoutOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "SinkCutout",
  },
  {
    category: "cooktopCutouts",
    label: "Cooktop Cutout Options",
    description: "Flat price per cutout, multiplied by quantity on the order.",
    modelKey: "fabricationCooktopCutoutOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "Cooktop",
  },
  {
    category: "bumpOut",
    label: "Bump Out Options",
    description: "e.g. Small (up to 7'), Large (over 7').",
    modelKey: "fabricationBumpOutOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "BumpOut",
  },
  {
    category: "cuttingBoard",
    label: "Cutting Board Options",
    description: "Flat price per cutting board, multiplied by quantity.",
    modelKey: "fabricationCuttingBoardOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "CuttingBoard",
  },
  {
    category: "windowsill",
    label: "Windowsill Options",
    description: "Flat price for windowsill work on an area.",
    modelKey: "fabricationWindowsillOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "Windowsill",
  },
  {
    category: "powerStation",
    label: "Power Station Options",
    description: "Flat price for power station cutouts.",
    modelKey: "fabricationPowerStationOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "PowerStation",
  },
  {
    category: "otherCharges",
    label: "Other Charges",
    description: "Catch-all miscellaneous charges.",
    modelKey: "fabricationOtherChargeOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "OtherCharge",
  },
  {
    category: "removal",
    label: "Removal Options",
    description: "Price for removing an existing countertop.",
    modelKey: "fabricationRemovalOption",
    dbField: "price",
    valueLabel: "Price",
    valuePrefix: "$",
    entityType: "Removal",
  },
];

export function getFabricationSettingsCategoryConfig(
  category: string,
): FabricationSettingsCategoryConfig | undefined {
  return FABRICATION_SETTINGS_CATEGORIES.find(
    (entry) => entry.category === category,
  );
}
