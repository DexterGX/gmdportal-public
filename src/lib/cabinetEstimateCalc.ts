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

export type CabinetEstimateFooterCalcInput = {
  cabinetsTotal: number;
  discount: number;
  removalAmount: number;
  installationAmount: number;
  customizationAmount: number;
};

export type CabinetEstimateFooterCalcResult = {
  cabinetsSubtotal: number;
  total: number;
};

// Footer price distribution, matches the printed estimate sheet:
// Cabinets -> Discount -> Cabinets Subtotal -> Removal -> Installation ->
// Customization -> Total
export function computeCabinetEstimateFooterTotals(
  input: CabinetEstimateFooterCalcInput,
): CabinetEstimateFooterCalcResult {
  const cabinetsSubtotal = round2(
    Math.max(0, (Number(input.cabinetsTotal) || 0) - (Number(input.discount) || 0)),
  );
  const total = round2(
    cabinetsSubtotal +
      (Number(input.removalAmount) || 0) +
      (Number(input.installationAmount) || 0) +
      (Number(input.customizationAmount) || 0),
  );
  return { cabinetsSubtotal, total };
}

export function formatCurrency(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}
