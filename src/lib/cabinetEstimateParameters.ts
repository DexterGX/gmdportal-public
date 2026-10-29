// GMD Parameters (round 9, reworked round 11) - the admin-tunable numbers
// that drive the Cabinet Estimate Installation auto-calculation. Mirrors
// the round-6-follow-up "vendors self-heal from companies" pattern:
// rather than requiring a manual seed step, every read of these settings
// first makes sure the singleton settings row and the 3 default
// Installation Types exist, creating whatever is missing.
//
// Round 11: the old 4-bucket CabinetInstallationLaborRate (Standard/
// Double/Custom/Misc flat $/unit) was replaced by a real, admin-managed
// Installers Price Table (CabinetInstallationServiceItem) - a much
// richer item-level list (base/wall cabinets, pantry cabinets, plus many
// add-on install services) that each cabinet catalog item gets AI/admin-
// assigned to (see cabinetCatalogImportAi.ts's installationItemHints).
// Per-installer cost (CabinetInstaller/CabinetInstallerServiceCost) is
// internal bookkeeping only and is never read here - only each service
// item's salePrice ("Venda") feeds an estimate's Installation total.
// customSurchargePercent still seeds to 0 on purpose - see project
// memory, round 9 - so it's visibly "not yet set" rather than a guessed
// real-money number.

const DEFAULT_INSTALLATION_TYPES = [
  { name: "Standard", multiplier: 1, sortOrder: 0 },
  { name: "Special", multiplier: 1.5, sortOrder: 1 },
  { name: "Custom", multiplier: 2, sortOrder: 2 },
];

export type CabinetEstimateParametersSettings = {
  id: string;
  installationBasePercent: number;
  installationCalcMode: "flat" | "perItem" | "higher";
  customSurchargePercent: number;
  costTaxPercent: number;
  catalogLinkUrl: string;
};

export type CabinetInstallationServiceItemRow = {
  id: string;
  code: string | null;
  description: string;
  salePrice: number;
  // Round 12 follow-up: when set, this item is the deterministic
  // installation-item assignment for every catalog item whose own
  // CabinetSummaryBucket matches - see the schema comment on
  // CabinetInstallationServiceItem.bucketDefault.
  bucketDefault: "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC" | null;
};

export type CabinetInstallationTypeRow = {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  sortOrder: number;
  isActive: boolean;
};

// Round 12: Removal Types (header dropdown, GMD-Parameters-managed) - a
// percent of the Cabinets total (pre-discount) that auto-computes the
// Removal $ amount, replacing the old fully-manual dollar input. Seeds
// completely empty - Diego gave no real percentages, so (like Installers'
// contact fields and unlike installationTypes' confirmed 1.0/1.5/2.0x
// multipliers) there is nothing to self-heal/default here; the list is
// simply whatever Diego adds via GMD Parameters.
export type CabinetRemovalTypeRow = {
  id: string;
  name: string;
  percent: number;
  sortOrder: number;
  isActive: boolean;
};

// Round 12: Project Types - for now just a manageable list of names for
// the header dropdown, no calculation tied to it (Diego's explicit
// "for now" scoping). Also seeds empty.
export type CabinetProjectTypeRow = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

// Discount dropdown choices (see model CabinetDiscountOption).
export type CabinetDiscountOptionRow = {
  id: string;
  percent: number;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

const DEFAULT_DISCOUNT_OPTIONS = [
  { percent: 0, label: "", sortOrder: 0 },
  { percent: 5, label: "", sortOrder: 1 },
  { percent: 10, label: "", sortOrder: 2 },
  { percent: 15, label: "", sortOrder: 3 },
  { percent: 20, label: "", sortOrder: 4 },
  { percent: 25, label: "Contractor", sortOrder: 5 },
];

export type CabinetEstimateParametersBundle = {
  settings: CabinetEstimateParametersSettings;
  installationServiceItems: CabinetInstallationServiceItemRow[];
  installationTypes: CabinetInstallationTypeRow[];
  removalTypes: CabinetRemovalTypeRow[];
  projectTypes: CabinetProjectTypeRow[];
  discountOptions: CabinetDiscountOptionRow[];
};

function toCalcMode(value: unknown): "flat" | "perItem" | "higher" {
  return value === "flat" || value === "perItem" ? value : "higher";
}

export async function getCabinetEstimateParameters(
  prismaAny: any,
): Promise<CabinetEstimateParametersBundle> {
  let settingsRow = await prismaAny.cabinetEstimateParameters.findFirst();
  if (!settingsRow) {
    settingsRow = await prismaAny.cabinetEstimateParameters.create({ data: {} });
  }

  const serviceItemRows = await prismaAny.cabinetInstallationServiceItem.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { description: "asc" }],
  });

  const existingTypesCount = await prismaAny.cabinetInstallationType.count();
  if (existingTypesCount === 0) {
    await prismaAny.cabinetInstallationType.createMany({
      data: DEFAULT_INSTALLATION_TYPES,
      skipDuplicates: true,
    });
  }
  const installationTypeRows = await prismaAny.cabinetInstallationType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Round 12: Removal Types / Project Types - no self-heal, no defaults.
  // Both lists return every row (active AND inactive), same as
  // installationTypes, so a currently-selected-but-now-deactivated option
  // still resolves for an estimate that already billed it.
  const removalTypeRows = await prismaAny.cabinetRemovalType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const projectTypeRows = await prismaAny.cabinetProjectType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Discount options self-seed the original fixed list the first time
  // they're read, so existing estimates/behavior are unchanged until an
  // admin edits the list on GMD Parameters.
  const existingDiscountCount = await prismaAny.cabinetDiscountOption.count();
  if (existingDiscountCount === 0) {
    await prismaAny.cabinetDiscountOption.createMany({
      data: DEFAULT_DISCOUNT_OPTIONS,
      skipDuplicates: true,
    });
  }
  const discountOptionRows = await prismaAny.cabinetDiscountOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { percent: "asc" }],
  });

  return {
    settings: {
      id: settingsRow.id,
      installationBasePercent: Number(settingsRow.installationBasePercent),
      installationCalcMode: toCalcMode(settingsRow.installationCalcMode),
      customSurchargePercent: Number(settingsRow.customSurchargePercent),
      costTaxPercent: Number(settingsRow.costTaxPercent) || 0,
      catalogLinkUrl: settingsRow.catalogLinkUrl || "",
    },
    installationServiceItems: serviceItemRows.map((item: any) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      salePrice: Number(item.salePrice),
      bucketDefault: item.bucketDefault || null,
    })),
    installationTypes: installationTypeRows.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description || "",
      multiplier: Number(t.multiplier),
      sortOrder: t.sortOrder,
      isActive: t.isActive,
    })),
    removalTypes: removalTypeRows.map((t: any) => ({
      id: t.id,
      name: t.name,
      percent: Number(t.percent),
      sortOrder: t.sortOrder,
      isActive: t.isActive,
    })),
    projectTypes: projectTypeRows.map((t: any) => ({
      id: t.id,
      name: t.name,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
    })),
    discountOptions: discountOptionRows.map((d: any) => ({
      id: d.id,
      percent: Number(d.percent),
      label: d.label || "",
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    })),
  };
}

// Server-side check for the client-supplied discount percent: it must match
// a configured option (active or not, so re-saving an old estimate that used
// a since-deactivated discount keeps it). Anything else falls back to 0.
export function resolveDiscountPercent(
  options: CabinetDiscountOptionRow[],
  requested: unknown,
): number {
  const pct = Math.trunc(Number(requested));
  if (!Number.isFinite(pct)) return 0;
  return options.some((o) => o.percent === pct) ? pct : 0;
}

// Picks the Installation Type to actually bill for a save: validates the
// client-supplied id against the live list (never trusts an arbitrary id),
// falling back to the first active type (Standard, by sort order) if
// missing/invalid/inactive.
export function resolveInstallationType(
  installationTypes: CabinetInstallationTypeRow[],
  requestedId: string | null | undefined,
): CabinetInstallationTypeRow | null {
  const active = installationTypes.filter((t) => t.isActive);
  const pool = active.length > 0 ? active : installationTypes;
  if (pool.length === 0) return null;
  const match = requestedId ? pool.find((t) => t.id === requestedId) : undefined;
  return match || pool[0] || null;
}

// Picks the Removal Type to actually bill for a save: validates the
// client-supplied id against the live list, falling back to the first
// active type if missing/invalid/inactive - same rule as
// resolveInstallationType. Unlike Installation Type, a null result here is
// a normal, expected state (no removal on this estimate at all), not
// something that needs a forced default - see the "" option in the
// header select.
export function resolveRemovalType(
  removalTypes: CabinetRemovalTypeRow[],
  requestedId: string | null | undefined,
): CabinetRemovalTypeRow | null {
  if (!requestedId) return null;
  const active = removalTypes.filter((t) => t.isActive);
  const pool = active.length > 0 ? active : removalTypes;
  return pool.find((t) => t.id === requestedId) || null;
}

// Maps an Installation Service Item id -> its current sale price ("Venda")
// - the number that actually feeds a customer estimate's Installation
// total in "perItem"/"higher" calc mode. A line whose installationItemId
// has no entry here (deactivated item, or never assigned) contributes $0.
//
// Deliberately typed to only the two fields actually used (not the full
// CabinetInstallationServiceItemRow) - callers that only fetch a lighter
// shape (e.g. the estimate form's live-preview state, which has no reason
// to carry bucketDefault) can pass it straight through without needing to
// fetch or fake fields this function never reads.
export function installationServiceItemPricesById(
  rows: { id: string; salePrice: number }[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) map[row.id] = row.salePrice;
  return map;
}

// Microwave Installation (Yes/No on the estimate form) is billed at the sale
// price of the Installers Price Table row whose description mentions
// "microwave" (e.g. "Microwave" $190). It is a flat add-on: it is NOT scaled
// by the Installation Type multiplier and not affected by the calc mode.
// No matching active row (or "No" selected) means $0.
// The Installers Price Table row that bills Microwave Installation.
export function findMicrowaveServiceItem<T extends { description: string }>(
  rows: T[],
): T | null {
  return rows.find((r) => /microwave/i.test(r.description || "")) || null;
}

export function computeMicrowaveInstallationAmount(
  enabled: boolean,
  rows: { description: string; salePrice: number }[],
): number {
  if (!enabled) return 0;
  const row = rows.find((r) => /microwave/i.test(r.description || ""));
  const price = Number(row?.salePrice) || 0;
  return Math.round((price + Number.EPSILON) * 100) / 100;
}
