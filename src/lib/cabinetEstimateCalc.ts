// Shared calc helpers for the Cabinet Estimate program - kept intentionally
// small for this first pass (manual entry, no price catalog yet). Mirrors
// the pattern used by src/lib/fabricationCalc.ts.

export type CabinetEstimateLineItemCalcInput = {
  qty: number;
  unitPrice: number;
};

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeLineItemTotal(qty: number, unitPrice: number): number {
  return round2((Number(qty) || 0) * (Number(unitPrice) || 0));
}

export function computeCabinetsTotal(
  items: CabinetEstimateLineItemCalcInput[],
): number {
  return round2(
    items.reduce(
      (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
      0,
    ),
  );
}

// Discount is chosen as a percentage of the cabinets total rather than typed
// in directly - 25% is the "Contractor" tier and is shown as that word, not
// a number, anywhere it's selectable.
export const DISCOUNT_PERCENT_OPTIONS = [0, 5, 10, 15, 20, 25] as const;

// `label` comes from the admin-managed CabinetDiscountOption row (GMD
// Parameters). When it is passed (even blank) it wins; without it we fall
// back to the original hard-coded 25 -> "Contractor" naming.
export function discountPercentLabel(
  percent: number,
  label?: string | null,
): string {
  if (label !== undefined && label !== null) {
    return label.trim() || `${percent}%`;
  }
  return percent === 25 ? "Contractor" : `${percent}%`;
}

export function computeDiscountAmount(
  cabinetsTotal: number,
  discountPercent: number,
): number {
  const pct = Number(discountPercent) || 0;
  return round2(((Number(cabinetsTotal) || 0) * pct) / 100);
}

// Per-line "Custom" surcharge: when a line item's Custom checkbox is
// checked, it carries its own extra Installation charge - a percent of
// that line's own qty*unitPrice. This surcharge never touches the line's
// own totalPrice/the Cabinets total; it's a separate amount that rolls
// into the Installation total instead. As of round 9 the percent itself
// is never typed per-line - it's a single global value set on the GMD
// Parameters page (CabinetEstimateParameters.customSurchargePercent),
// applied to every checked line the same way. `customizationValue` on
// CabinetEstimateLineItem still stores the percent that was actually in
// effect when the line was last saved (server-stamped, never trusted from
// the client - see the save routes), which is why this still takes a
// percent parameter rather than reading a constant.
export type LineItemCustomizationCalcInput = {
  qty: number;
  unitPrice: number;
  isCustomization: boolean;
  customizationValue: number; // the percent in effect when this line was saved
};

export function computeLineItemCustomizationSurcharge(
  qty: number,
  unitPrice: number,
  isCustomization: boolean,
  customizationValue: number,
): number {
  if (!isCustomization) return 0;
  const q = Number(qty) || 0;
  const percent = Number(customizationValue) || 0;
  return round2(q * (Number(unitPrice) || 0) * (percent / 100));
}

export function computeLineItemsCustomizationSurchargeTotal(
  items: LineItemCustomizationCalcInput[],
): number {
  return round2(
    items.reduce(
      (sum, item) =>
        sum +
        computeLineItemCustomizationSurcharge(
          item.qty,
          item.unitPrice,
          item.isCustomization,
          item.customizationValue,
        ),
      0,
    ),
  );
}

// Base Installation (round 9, per-item source reworked round 11) - the
// "which formula do we use" question from Diego: either a flat percent of
// the Cabinets total (pre-discount), a per-item amount keyed by each
// catalog-linked line's assigned Installers Price Table row
// (installationItemId - AI/admin-assigned at import time, see
// cabinetCatalogImportAi.ts's installationItemHints), or whichever of the
// two comes out higher (the default, matching how Diego described doing
// this today). A line with no catalog match, or no installation-item
// assignment yet, contributes $0 to the per-item half - same tolerant
// behavior the Cabinets Summary counts already have for a missing
// summaryBucket, not a new gap.
export type InstallationCalcMode = "flat" | "perItem" | "higher";

export type InstallationLineItemCalcInput = {
  qty: number;
  unitPrice: number;
  installationItemId: string | null | undefined;
};

export type InstallationServiceItemPricesById = Record<string, number>;

export function computePerItemInstallationAmount(
  items: InstallationLineItemCalcInput[],
  installationServiceItemPrices: InstallationServiceItemPricesById,
): number {
  return round2(
    items.reduce((sum, item) => {
      if (!item.installationItemId) return sum;
      const price = Number(installationServiceItemPrices[item.installationItemId]) || 0;
      return sum + (Number(item.qty) || 0) * price;
    }, 0),
  );
}

export function computeBaseInstallationAmount(input: {
  cabinetsTotal: number;
  lineItems: InstallationLineItemCalcInput[];
  installationServiceItemPrices: InstallationServiceItemPricesById;
  calcMode: InstallationCalcMode;
  basePercent: number;
}): number {
  const flatAmount = round2(
    ((Number(input.cabinetsTotal) || 0) * (Number(input.basePercent) || 0)) /
      100,
  );
  const perItemAmount = computePerItemInstallationAmount(
    input.lineItems,
    input.installationServiceItemPrices,
  );
  if (input.calcMode === "flat") return flatAmount;
  if (input.calcMode === "perItem") return perItemAmount;
  return round2(Math.max(flatAmount, perItemAmount));
}

// Round 12: Removal is no longer a manually-typed dollar amount - the
// user picks a Removal Type (GMD-Parameters-managed, admin sets a percent
// per type) and the $ amount is always a percent of the Cabinets total
// BEFORE discounts are applied ("cabinetsTotal", not "cabinetsSubtotal" -
// Diego was explicit: "a percentage of the cabinets before discounts are
// applied"). No Removal Type selected means $0, same tolerant-zero
// behavior used everywhere else in this program for an unset selection.
export function computeRemovalAmount(
  cabinetsTotal: number,
  percent: number | null | undefined,
): number {
  return round2(((Number(cabinetsTotal) || 0) * (Number(percent) || 0)) / 100);
}

// Special Customization: an admin-managed catalog of customization types
// (name + price). Estimate rows just pick a type and a qty - the $ amount
// is always derived, never typed in directly.
export type SpecialCustomizationLineCalcInput = {
  qty: number;
  price: number;
};

export function computeSpecialCustomizationLineAmount(
  qty: number,
  price: number,
): number {
  return round2((Number(qty) || 0) * (Number(price) || 0));
}

export function computeSpecialCustomizationTotal(
  lines: SpecialCustomizationLineCalcInput[],
): number {
  return round2(
    lines.reduce(
      (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0),
      0,
    ),
  );
}

// The "Installation" total shown/used everywhere is the manually-entered
// base amount plus both computed customization add-ons (the Special
// Customization catalog total, and the sum of per-line Custom surcharges) -
// there's no separate "Customization" row anymore, it's folded in here.
export function computeInstallationTotal(
  installationAmount: number,
  specialCustomizationAmount: number,
  lineCustomizationSurchargeAmount: number,
): number {
  return round2(
    (Number(installationAmount) || 0) +
      (Number(specialCustomizationAmount) || 0) +
      (Number(lineCustomizationSurchargeAmount) || 0),
  );
}

export type CabinetEstimateFooterCalcInput = {
  cabinetsTotal: number;
  discount: number;
  removalAmount: number;
  installationAmount: number;
  customizationAmount: number;
  lineCustomizationSurchargeAmount: number;
};

export type CabinetEstimateFooterCalcResult = {
  cabinetsSubtotal: number;
  installationTotal: number;
  total: number;
};

// Footer price distribution, matches the printed estimate sheet:
// Cabinets -> Discount -> Cabinets Subtotal -> Removal -> Installation
// (manual amount + Special Customization total + per-line Custom
// surcharges, all folded together) -> Total
export function computeCabinetEstimateFooterTotals(
  input: CabinetEstimateFooterCalcInput,
): CabinetEstimateFooterCalcResult {
  const cabinetsSubtotal = round2(
    Math.max(0, (Number(input.cabinetsTotal) || 0) - (Number(input.discount) || 0)),
  );
  const installationTotal = computeInstallationTotal(
    input.installationAmount,
    input.customizationAmount,
    input.lineCustomizationSurchargeAmount,
  );
  const total = round2(
    cabinetsSubtotal + (Number(input.removalAmount) || 0) + installationTotal,
  );
  return { cabinetsSubtotal, installationTotal, total };
}

export function formatCurrency(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

// Diego-requested cosmetic flourish for the printed/on-screen estimate
// header: a bold 16-digit "card number"-style string (4 groups of 4) where
// the FIRST and LAST groups together encode the estimate's COST (our vendor
// cost, see computeCabinetsCost - not the selling total)
// (so it's a meaningful live value, not pure decoration) and the two
// middle groups are random filler. Example: a $12,420 total -> rounded to
// whole dollars and zero-padded to 8 digits ("00012420") -> group 1 is the
// first 4 digits ("0001"), group 4 the last 4 ("2420") - concatenating
// group1+group4 and stripping leading zeros reconstructs 12420 exactly.
// Caps at 8 digits (~$99.9M total), far past any real estimate.
// Our own (vendor net) cost of the cabinets on an estimate. Line prices on
// an estimate are sell prices = stored net cost x the vendor company's sales
// factor (see computeCabinetSellPrice in cabinetCatalogPricing.ts), so
// dividing the Cabinets total by that factor gets back what we pay the
// vendor. Pre-discount, excludes removal/installation. factor <= 0 or
// missing is treated as 1, same as the sell-price side.
export function computeCabinetsCost(
  cabinetsTotal: number | null | undefined,
  factor: number | null | undefined,
): number {
  const total = Number(cabinetsTotal) || 0;
  const f = Number(factor);
  return round2(total / (Number.isFinite(f) && f > 0 ? f : 1));
}

export function generateRandomDigits(count: number): string {
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += Math.floor(Math.random() * 10);
  }
  return out;
}

export function formatEstimateReferenceNumber(
  total: number | null | undefined,
  randomDigits: string,
): string {
  const amount = Math.max(0, Math.round(Number(total) || 0));
  const costDigits = String(amount).slice(-8).padStart(8, "0");
  const group1 = costDigits.slice(0, 4);
  const group4 = costDigits.slice(4, 8);
  const safeRandom = /^\d{8}$/.test(randomDigits) ? randomDigits : "00000000";
  const group2 = safeRandom.slice(0, 4);
  const group3 = safeRandom.slice(4, 8);
  return `${group1} ${group2} ${group3} ${group4}`;
}
