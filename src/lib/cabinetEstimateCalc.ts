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

export function discountPercentLabel(percent: number): string {
  return percent === 25 ? "Contractor" : `${percent}%`;
}

export function computeDiscountAmount(
  cabinetsTotal: number,
  discountPercent: number,
): number {
  const pct = Number(discountPercent) || 0;
  return round2(((Number(cabinetsTotal) || 0) * pct) / 100);
}

// Per-line "Custom" surcharge: when a line item is flagged Custom, it
// carries its own extra Installation charge - either a percent of that
// line's own qty*unitPrice, or a flat $ amount per unit. This surcharge
// never touches the line's own totalPrice/the Cabinets total; it's a
// separate amount that rolls into the Installation total instead.
// Example (Diego, 2026-09-02): a $500 cabinet marked Custom at 10% adds
// $500 to Cabinets (as always) and $50 to Installation.
export type CustomizationType = "percent" | "flat";

export type LineItemCustomizationCalcInput = {
  qty: number;
  unitPrice: number;
  isCustomization: boolean;
  customizationType: CustomizationType | null | undefined;
  customizationValue: number;
};

export function computeLineItemCustomizationSurcharge(
  qty: number,
  unitPrice: number,
  customizationType: CustomizationType | null | undefined,
  customizationValue: number,
): number {
  const q = Number(qty) || 0;
  const value = Number(customizationValue) || 0;
  if (customizationType === "percent") {
    return round2(q * (Number(unitPrice) || 0) * (value / 100));
  }
  if (customizationType === "flat") {
    return round2(q * value);
  }
  return 0;
}

export function computeLineItemsCustomizationSurchargeTotal(
  items: LineItemCustomizationCalcInput[],
): number {
  return round2(
    items.reduce((sum, item) => {
      if (!item.isCustomization) return sum;
      return (
        sum +
        computeLineItemCustomizationSurcharge(
          item.qty,
          item.unitPrice,
          item.customizationType,
          item.customizationValue,
        )
      );
    }, 0),
  );
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
