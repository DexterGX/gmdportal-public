// "Preco de Custo": the cost-only view of a Cabinet Estimate - what the
// vendor actually charges us (not the customer's price) plus what the chosen
// installer charges to install. Pure helpers shared by the estimate form and
// the print page.

import { round2 } from "@/lib/cabinetEstimateCalc";

// Who may see vendor/installer cost: admins (incl. Program Admins of Cabinet
// Estimates - their effective role is "admin") and the finance role.
export function canViewCabinetCost(ctx: {
  appRole?: string | null;
  appRoles?: string[] | null;
}): boolean {
  return ctx.appRole === "admin" || Boolean(ctx.appRoles?.includes("finance"));
}

export type CostSummaryInput = {
  cabinetsCost: number;
  taxPercent: number;
  installationCost: number;
};

export type CostSummary = {
  cabinetsCost: number;
  tax: number;
  cabinetsSubtotal: number;
  installationCost: number;
  total: number;
};

// Cabinets (cost) -> Tax -> Cabinets Subtotal -> Installation (cost) -> Total
export function computeCostSummary(input: CostSummaryInput): CostSummary {
  const cabinetsCost = round2(Number(input.cabinetsCost) || 0);
  const tax = round2((cabinetsCost * (Number(input.taxPercent) || 0)) / 100);
  const cabinetsSubtotal = round2(cabinetsCost + tax);
  const installationCost = round2(Number(input.installationCost) || 0);
  return {
    cabinetsCost,
    tax,
    cabinetsSubtotal,
    installationCost,
    total: round2(cabinetsSubtotal + installationCost),
  };
}

// What one installer charges for this estimate: each catalog-linked line is
// qty x that installer's cost for the line's Installers Price Table item,
// plus the Microwave item when Microwave Installation = Yes. Lines with no
// item (or no cost entered for this installer) add $0 and are counted so the
// UI can warn about them.
export function computeInstallerCost(input: {
  lines: { qty: number; installationItemId: string | null | undefined }[];
  costsByItemId: Record<string, number>;
  microwave: boolean;
  microwaveItemId: string | null | undefined;
}): { amount: number; missingCount: number } {
  let amount = 0;
  let missingCount = 0;
  for (const line of input.lines) {
    const qty = Number(line.qty) || 0;
    if (qty <= 0) continue;
    if (!line.installationItemId) {
      missingCount += 1;
      continue;
    }
    const cost = input.costsByItemId[line.installationItemId];
    if (cost === undefined) {
      missingCount += 1;
      continue;
    }
    amount += qty * (Number(cost) || 0);
  }
  if (input.microwave && input.microwaveItemId) {
    amount += Number(input.costsByItemId[input.microwaveItemId]) || 0;
  }
  return { amount: round2(amount), missingCount };
}

export function costsByItemIdForInstaller(
  costs: { installerId: string; itemId: string; cost: number }[],
  installerId: string,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of costs) {
    if (c.installerId === installerId) map[c.itemId] = c.cost;
  }
  return map;
}
