// Round 6 pricing helpers for the cabinet catalog import/estimate flow.
//
// Mirrors the pattern in src/lib/slabsPricing.ts (computeFinalPrice) and
// src/lib/sinksImport.ts (calculateSinkFinalPrice) - same "discount"
// (fraction off retail) and "factor" (sales multiplier) fields, sourced
// from CabinetProviderSettings.
//
// Deliberate difference from that precedent: Slabs/Sinks bake both
// discount and factor into a single stored finalPrice at import/edit time,
// so changing a brand's factor later doesn't affect existing rows until
// they're re-saved. For cabinets, only the discount conversion happens at
// import time (see computeCabinetNetCost, used by cabinetCatalogImport.ts) -
// the stored CabinetCatalogItemPrice.price is always net cost. The sales
// factor is applied live, via computeCabinetSellPrice, wherever a price is
// looked up for an estimate (src/app/api/cabinet-catalog/items/route.ts) -
// so bumping a company's factor takes effect immediately, with no re-import.

import { round2 } from "./cabinetEstimateCalc";

/**
 * Converts a vendor's raw/retail price into GMD's actual cost, using that
 * company's discount fraction (0.30 = 30% off retail). Only applied at
 * import time, and only when the admin marks the uploaded file as "retail".
 */
export function computeCabinetNetCost(rawPrice: number, discount: number): number {
  const price = Number.isFinite(rawPrice) ? rawPrice : 0;
  const d = Number.isFinite(discount) ? discount : 0;
  return round2(price * (1 - d));
}

/**
 * Applies a company's sales multiplier on top of a stored net cost to get
 * the price shown/used in an estimate. factor defaults to 1 (no change) for
 * any vendor not linked to a company record, or a company with no factor set.
 */
export function computeCabinetSellPrice(netCost: number, factor: number): number {
  const cost = Number.isFinite(netCost) ? netCost : 0;
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return round2(cost * f);
}
