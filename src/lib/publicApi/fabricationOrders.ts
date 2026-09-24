import "server-only";
import { num } from "@/lib/apiKeys";

// Shapes FabricationOrder rows for the external /api/v1 API. Kept separate from
// the internal UI routes so the public contract stays stable even if the
// portal's own screens change.

const THICKNESS_LABELS: Record<string, string> = {
  SIX_MM: "6mm",
  EIGHT_MM: "8mm",
  TEN_MM: "10mm",
  TWELVE_MM: "12mm",
  TWO_CM: "2cm",
  THREE_CM: "3cm",
};

const optionName = (option: { name?: string | null } | null | undefined) =>
  option?.name ?? null;

export const fabricationOrderInclude = (detail: boolean) => ({
  job: {
    select: {
      id: true,
      jobNumber: true,
      jobName: true,
      propertyAddress: true,
      status: true,
      customer: { select: { id: true, displayName: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
  areas: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      sinkTypeOption: true,
      slabSupplier: { select: { id: true, name: true } },
      slabType: true,
      sinkCutoutOption: true,
      cooktopOption: true,
      bumpOutOption: true,
      cuttingBoardOption: true,
      windowsillOption: true,
      powerStationOption: true,
      otherChargeOption: true,
      removalOption: true,
      sections: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          edgeType: true,
          buildUpType: true,
          rows: detail ? { orderBy: { sortOrder: "asc" as const } } : false,
        },
      },
      images: detail ? { orderBy: { uploadedAt: "asc" as const } } : false,
    },
  },
});

function serializeArea(area: any, detail: boolean, includePricing: boolean) {
  const base: Record<string, unknown> = {
    id: area.id,
    name: area.name,
    sortOrder: area.sortOrder,
    stone: {
      name: area.stoneName ?? null,
      thickness: area.stoneThickness
        ? THICKNESS_LABELS[area.stoneThickness] ?? area.stoneThickness
        : null,
      supplier: area.slabSupplier?.name ?? area.slabSupplierCustomName ?? null,
      slabType: optionName(area.slabType),
      slabQty: area.slabQty ?? 0,
      slabRecommendedQty: area.slabRecommendedQty ?? 0,
      slabAreaLabel: area.slabAreaLabel ?? null,
      warehouseNumber: area.whNumber ?? null,
    },
    sink: {
      type: optionName(area.sinkTypeOption),
      model: area.sinkTypeText ?? null,
      qty: area.sinkQty ?? null,
      faucet: area.faucetText ?? null,
    },
    backsplash: {
      has: Boolean(area.backsplashHas),
      heightIn: num(area.backsplashIn),
    },
    sqft: num(area.jobSqft),
    sections: (area.sections || []).map((section: any) => ({
      id: section.id,
      label: section.label ?? null,
      edge: optionName(section.edgeType),
      buildUp: optionName(section.buildUpType),
      sqft: num(section.sqftTotal),
      ...(detail
        ? {
            pieces: (section.rows || []).map((row: any) => ({
              lengthIn: num(row.lengthIn),
              widthIn: num(row.widthIn),
              sqft: num(row.sqft),
            })),
          }
        : {}),
    })),
    cutoutsAndExtras: {
      sinkCutout: area.sinkCutoutOption
        ? { option: area.sinkCutoutOption.name, qty: area.sinkCutoutQty }
        : null,
      cooktopCutout: area.cooktopOption
        ? { option: area.cooktopOption.name, qty: area.cooktopQty }
        : null,
      bumpOut: area.bumpOutOption
        ? { option: area.bumpOutOption.name, qty: area.bumpOutQty }
        : null,
      cuttingBoard: area.cuttingBoardOption
        ? { option: area.cuttingBoardOption.name, qty: area.cuttingBoardQty }
        : null,
      windowsill: optionName(area.windowsillOption),
      powerStation: optionName(area.powerStationOption),
      otherCharge: area.otherChargeOption?.name ?? area.otherChargeCustomName ?? null,
      removal: optionName(area.removalOption),
    },
    leftover: area.leftoverNote ?? null,
  };

  if (includePricing) {
    base.pricing = {
      slabAmount: num(area.slabAmount),
      labor: num(area.labor),
      buildUp: num(area.buildUp),
      sinkCutoutTotal: num(area.sinkCutoutTotal),
      cooktopTotal: num(area.cooktopTotal),
      bumpOutTotal: num(area.bumpOutTotal),
      cuttingBoardTotal: num(area.cuttingBoardTotal),
      windowsillTotal: num(area.windowsillTotal),
      powerStationTotal: num(area.powerStationTotal),
      otherChargeTotal: num(area.otherChargeTotal),
      removalTotal: num(area.removalTotal),
      areaTotal: num(area.areaTotal),
    };
  }

  if (detail) {
    base.drawing = {
      mode: area.drawingMode,
      canvasData: area.canvasData ?? null,
    };
    base.images = (area.images || []).map((image: any) => ({
      id: image.id,
      url: image.fileUrl,
      caption: image.caption ?? null,
      uploadedAt: image.uploadedAt,
    }));
  }

  return base;
}

export function serializeFabricationOrder(
  order: any,
  { detail, includePricing }: { detail: boolean; includePricing: boolean },
) {
  const areas = (order.areas || []).map((area: any) =>
    serializeArea(area, detail, includePricing),
  );
  const totalSqft = (order.areas || []).reduce(
    (sum: number, area: any) => sum + (num(area.jobSqft) ?? 0),
    0,
  );

  return {
    id: order.id,
    orderNumber: order.orderNumber ?? null,
    date: order.date,
    isArchived: !order.isActive,
    clientName: order.clientName,
    salesRep: order.salesRep,
    notes: order.notes ?? null,
    pipedriveDealId: order.dealId ?? null,
    dealName: order.dealName ?? null,
    job: order.job
      ? {
          id: order.job.id,
          jobNumber: order.job.jobNumber,
          jobName: order.job.jobName,
          status: order.job.status,
          propertyAddress: order.job.propertyAddress ?? null,
          customer: order.job.customer
            ? { id: order.job.customer.id, name: order.job.customer.displayName }
            : null,
        }
      : null,
    createdBy: order.createdBy?.name ?? null,
    totalSqft: Math.round(totalSqft * 100) / 100,
    ...(includePricing ? { total: num(order.total) } : {}),
    areaCount: areas.length,
    areas,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
