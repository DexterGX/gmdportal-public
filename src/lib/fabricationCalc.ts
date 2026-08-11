// Shared pricing/calculation logic for Fabrication Orders.
// Used both client-side (live preview while editing) and server-side
// (authoritative recompute at save time, using current settings prices).
//
// Confirmed formulas (see project history for how these were derived/confirmed):
// - Job SqFt = sum of sqft across all non build-up sections in an area.
// - Labor = Job SqFt x Edge Type price/sqft x Slab Type multiplier (summed per-section
//   to support mixed edge types within one area).
// - Build-Up = same idea but for sections whose edge type is flagged isBuildUp.
// - Sink/Cooktop/BumpOut/CuttingBoard = qty x flat price.
// - Windowsill/PowerStation/OtherCharge/Removal = flat price (no qty).
// - Slab Amount (the price the slab is sold for) is added straight into the Total.
// - Leftover is informational only, no $ effect.
// - Area Total = Labor + BuildUp + SinkCutout + Cooktop + BumpOut + CuttingBoard +
//   Windowsill + PowerStation + OtherCharge + Removal + SlabAmount.
// - Order Total = sum of Area Totals.
// - Recommended slab qty = ceil(((JobSqFt + BuildUpSqFt) x 1.15) / SqFt per slab),
//   flagged red if the entered Slab Qty is below that.

export const SLAB_WASTE_BUFFER = 1.15;

export interface CalcRow {
  lengthIn: number;
  widthIn: number;
}

export interface CalcSection {
  isBuildUp: boolean;
  pricePerSqft: number;
  rows: CalcRow[];
}

export interface CalcAreaInput {
  sections: CalcSection[];
  slabTypeMultiplier: number;

  sinkCutoutQty: number;
  sinkCutoutPrice: number;
  cooktopQty: number;
  cooktopPrice: number;
  bumpOutQty: number;
  bumpOutPrice: number;
  cuttingBoardQty: number;
  cuttingBoardPrice: number;
  windowsillPrice: number;
  powerStationPrice: number;
  otherChargePrice: number;
  removalPrice: number;

  slabAmount: number;
  slabLengthIn: number;
  slabWidthIn: number;
  slabQty: number;
}

export interface CalcAreaResult {
  jobSqft: number;
  buildUpSqft: number;
  labor: number;
  buildUp: number;
  sinkCutoutTotal: number;
  cooktopTotal: number;
  bumpOutTotal: number;
  cuttingBoardTotal: number;
  windowsillTotal: number;
  powerStationTotal: number;
  otherChargeTotal: number;
  removalTotal: number;
  slabPieceSqft: number;
  slabRecommendedQty: number;
  slabQtyFlagged: boolean;
  areaTotal: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeSectionSqft(section: CalcSection): number {
  const total = section.rows.reduce((sum, row) => {
    const l = Number(row.lengthIn) || 0;
    const w = Number(row.widthIn) || 0;
    if (l <= 0 || w <= 0) return sum;
    return sum + (l * w) / 144;
  }, 0);
  return round2(total);
}

export function computeAreaTotals(area: CalcAreaInput): CalcAreaResult {
  const multiplier = area.slabTypeMultiplier > 0 ? area.slabTypeMultiplier : 1;

  let jobSqft = 0;
  let buildUpSqft = 0;
  let labor = 0;
  let buildUp = 0;

  for (const section of area.sections) {
    const sqft = computeSectionSqft(section);
    const lineTotal = sqft * (Number(section.pricePerSqft) || 0) * multiplier;
    if (section.isBuildUp) {
      buildUpSqft += sqft;
      buildUp += lineTotal;
    } else {
      jobSqft += sqft;
      labor += lineTotal;
    }
  }

  jobSqft = round2(jobSqft);
  buildUpSqft = round2(buildUpSqft);
  labor = round2(labor);
  buildUp = round2(buildUp);

  const sinkCutoutTotal = round2(
    (Number(area.sinkCutoutQty) || 0) * (Number(area.sinkCutoutPrice) || 0),
  );
  const cooktopTotal = round2(
    (Number(area.cooktopQty) || 0) * (Number(area.cooktopPrice) || 0),
  );
  const bumpOutTotal = round2(
    (Number(area.bumpOutQty) || 0) * (Number(area.bumpOutPrice) || 0),
  );
  const cuttingBoardTotal = round2(
    (Number(area.cuttingBoardQty) || 0) * (Number(area.cuttingBoardPrice) || 0),
  );
  const windowsillTotal = round2(Number(area.windowsillPrice) || 0);
  const powerStationTotal = round2(Number(area.powerStationPrice) || 0);
  const otherChargeTotal = round2(Number(area.otherChargePrice) || 0);
  const removalTotal = round2(Number(area.removalPrice) || 0);
  const slabAmount = round2(Number(area.slabAmount) || 0);

  const slabLengthIn = Number(area.slabLengthIn) || 0;
  const slabWidthIn = Number(area.slabWidthIn) || 0;
  const slabPieceSqft =
    slabLengthIn > 0 && slabWidthIn > 0
      ? round2((slabLengthIn * slabWidthIn) / 144)
      : 0;
  const slabRecommendedQty =
    slabPieceSqft > 0
      ? Math.ceil(((jobSqft + buildUpSqft) * SLAB_WASTE_BUFFER) / slabPieceSqft)
      : 0;
  const slabQty = Number(area.slabQty) || 0;
  const slabQtyFlagged = slabRecommendedQty > 0 && slabQty < slabRecommendedQty;

  const areaTotal = round2(
    labor +
      buildUp +
      sinkCutoutTotal +
      cooktopTotal +
      bumpOutTotal +
      cuttingBoardTotal +
      windowsillTotal +
      powerStationTotal +
      otherChargeTotal +
      removalTotal +
      slabAmount,
  );

  return {
    jobSqft,
    buildUpSqft,
    labor,
    buildUp,
    sinkCutoutTotal,
    cooktopTotal,
    bumpOutTotal,
    cuttingBoardTotal,
    windowsillTotal,
    powerStationTotal,
    otherChargeTotal,
    removalTotal,
    slabPieceSqft,
    slabRecommendedQty,
    slabQtyFlagged,
    areaTotal,
  };
}

export function formatCurrency(value: number): string {
  return (Number(value) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
