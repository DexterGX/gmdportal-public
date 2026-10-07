import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { computeAreaTotals, type CalcAreaInput } from "@/lib/fabricationCalc";
import { saveOrderAreaImages, copyOrderAreaImages } from "@/lib/fabricationImages";
import { syncFabricationOrderArtifact } from "@/lib/fabricationOrderArtifact";

const prismaAny = prisma as any;

async function requireCreator() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("fabricationOrders");
  if (!user || !isActive || appRoles.length === 0) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!canAccess) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user, appRole };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const FAB_ORDER_NUMBER_PREFIX = "FO";

function isOrderNumberUniqueConstraintError(error: any) {
  if (error?.code !== "P2002") return false;
  const target = error?.meta?.target;
  if (Array.isArray(target)) return target.includes("orderNumber");
  if (typeof target === "string") return target.includes("orderNumber");
  return false;
}

// Auto-generates "FOYYMMXXX" — same convention as Payment Term, but derived
// from the max existing sequence in the month (not a raw count) so a deleted
// or archived order mid-month can't cause a collision.
async function generateMonthlyFabOrderNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthToken = `${FAB_ORDER_NUMBER_PREFIX}${yy}${mm}`;

  const monthOrders = await prismaAny.fabricationOrder.findMany({
    where: { orderNumber: { startsWith: monthToken } },
    select: { orderNumber: true },
    take: 5000,
  });

  let maxSequence = 0;
  const pattern = new RegExp(`^${monthToken}(\\d+)$`);
  for (const order of monthOrders) {
    const match = String(order.orderNumber ?? "").match(pattern);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) maxSequence = Math.max(maxSequence, parsed);
  }

  const seq = String(maxSequence + 1).padStart(3, "0");
  return `${monthToken}${seq}`;
}

async function loadSettingsMaps() {
  const [
    edgeTypes,
    slabTypes,
    sinkCutouts,
    cooktops,
    bumpOuts,
    cuttingBoards,
    windowsills,
    powerStations,
    otherCharges,
    removals,
    slabSuppliers,
  ] = await Promise.all([
    prismaAny.fabricationEdgeType.findMany(),
    prismaAny.fabricationSlabTypeOption.findMany(),
    prismaAny.fabricationSinkCutoutOption.findMany(),
    prismaAny.fabricationCooktopCutoutOption.findMany(),
    prismaAny.fabricationBumpOutOption.findMany(),
    prismaAny.fabricationCuttingBoardOption.findMany(),
    prismaAny.fabricationWindowsillOption.findMany(),
    prismaAny.fabricationPowerStationOption.findMany(),
    prismaAny.fabricationOtherChargeOption.findMany(),
    prismaAny.fabricationRemovalOption.findMany(),
    prismaAny.slabBrandConfig.findMany(),
  ]);

  const byId = (list: any[]) => new Map(list.map((item) => [item.id, item]));

  return {
    edgeTypes: byId(edgeTypes),
    slabTypes: byId(slabTypes),
    sinkCutouts: byId(sinkCutouts),
    cooktops: byId(cooktops),
    bumpOuts: byId(bumpOuts),
    cuttingBoards: byId(cuttingBoards),
    windowsills: byId(windowsills),
    powerStations: byId(powerStations),
    otherCharges: byId(otherCharges),
    removals: byId(removals),
    slabSuppliers: byId(slabSuppliers),
  };
}

type SectionPayload = {
  id?: string;
  edgeTypeId?: string | null;
  sortOrder?: number;
  rows?: Array<{ lengthIn?: number; widthIn?: number; sortOrder?: number }>;
};

type ImagePayload = {
  keepIds?: string[];
  newImages?: Array<{ dataUrl: string; caption?: string }>;
  // "Save as New" carries over an existing area's already-uploaded images by
  // reference (same Supabase fileUrl) rather than re-uploading them.
  copyExisting?: Array<{ fileUrl: string; caption?: string | null }>;
};

type AreaPayload = {
  id?: string;
  name?: string;
  sortOrder?: number;
  sinkTypeOptionId?: string | null;
  sinkTypeText?: string | null;
  sinkQty?: number | string | null;
  faucetText?: string | null;
  stoneName?: string | null;
  stoneThickness?: string | null;
  whNumber?: string | null;
  backsplashHas?: boolean;
  backsplashIn?: number | null;
  slabSupplierId?: string | null;
  slabSupplierCustomName?: string | null;
  slabLengthIn?: number;
  slabWidthIn?: number;
  slabQty?: number;
  slabTypeId?: string | null;
  slabAmount?: number;
  sinkCutoutOptionId?: string | null;
  sinkCutoutQty?: number;
  cooktopOptionId?: string | null;
  cooktopQty?: number;
  bumpOutOptionId?: string | null;
  bumpOutQty?: number;
  cuttingBoardOptionId?: string | null;
  cuttingBoardQty?: number;
  windowsillOptionId?: string | null;
  powerStationOptionId?: string | null;
  otherChargeOptionId?: string | null;
  otherChargeCustomName?: string | null;
  otherChargeCustomPrice?: number | null;
  removalOptionId?: string | null;
  leftoverNote?: string | null;
  drawingMode?: "CANVAS" | "IMAGE";
  canvasData?: unknown;
  sections?: SectionPayload[];
  images?: ImagePayload;
};

async function buildAreaCreateData(
  area: AreaPayload,
  maps: Awaited<ReturnType<typeof loadSettingsMaps>>,
) {
  const sections = (area.sections || []).map((section) => {
    const edgeType = section.edgeTypeId
      ? maps.edgeTypes.get(section.edgeTypeId)
      : null;
    return {
      edgeTypeId: section.edgeTypeId || null,
      isBuildUp: Boolean(edgeType?.isBuildUp),
      pricePerSqft: toNumber(edgeType?.pricePerSqft),
      sortOrder: section.sortOrder ?? 0,
      rows: (section.rows || []).map((row, idx) => ({
        lengthIn: toNumber(row.lengthIn),
        widthIn: toNumber(row.widthIn),
        sortOrder: row.sortOrder ?? idx,
      })),
    };
  });

  const slabType = area.slabTypeId ? maps.slabTypes.get(area.slabTypeId) : null;
  const sinkCutout = area.sinkCutoutOptionId
    ? maps.sinkCutouts.get(area.sinkCutoutOptionId)
    : null;
  const cooktop = area.cooktopOptionId
    ? maps.cooktops.get(area.cooktopOptionId)
    : null;
  const bumpOut = area.bumpOutOptionId
    ? maps.bumpOuts.get(area.bumpOutOptionId)
    : null;
  const cuttingBoard = area.cuttingBoardOptionId
    ? maps.cuttingBoards.get(area.cuttingBoardOptionId)
    : null;
  const windowsill = area.windowsillOptionId
    ? maps.windowsills.get(area.windowsillOptionId)
    : null;
  const powerStation = area.powerStationOptionId
    ? maps.powerStations.get(area.powerStationOptionId)
    : null;
  const otherCharge = area.otherChargeOptionId
    ? maps.otherCharges.get(area.otherChargeOptionId)
    : null;
  const removal = area.removalOptionId
    ? maps.removals.get(area.removalOptionId)
    : null;
  const hasCustomOtherCharge = Boolean(area.otherChargeCustomName?.trim());
  const otherChargePrice = hasCustomOtherCharge
    ? toNumber(area.otherChargeCustomPrice)
    : toNumber(otherCharge?.price);

  const calcInput: CalcAreaInput = {
    sections: sections.map((s) => ({
      isBuildUp: s.isBuildUp,
      pricePerSqft: s.pricePerSqft,
      rows: s.rows,
    })),
    slabTypeMultiplier: toNumber(slabType?.multiplier) || 1,
    sinkCutoutQty: toNumber(area.sinkCutoutQty),
    sinkCutoutPrice: toNumber(sinkCutout?.price),
    cooktopQty: toNumber(area.cooktopQty),
    cooktopPrice: toNumber(cooktop?.price),
    bumpOutQty: toNumber(area.bumpOutQty),
    bumpOutPrice: toNumber(bumpOut?.price),
    cuttingBoardQty: toNumber(area.cuttingBoardQty),
    cuttingBoardPrice: toNumber(cuttingBoard?.price),
    windowsillPrice: windowsill ? toNumber(windowsill.price) : 0,
    powerStationPrice: powerStation ? toNumber(powerStation.price) : 0,
    otherChargePrice,
    removalPrice: removal ? toNumber(removal.price) : 0,
    slabAmount: toNumber(area.slabAmount),
    slabLengthIn: toNumber(area.slabLengthIn),
    slabWidthIn: toNumber(area.slabWidthIn),
    slabQty: toNumber(area.slabQty),
  };

  const result = computeAreaTotals(calcInput);

  return {
    data: {
      name: area.name?.trim() || "Untitled Area",
      sortOrder: area.sortOrder ?? 0,
      sinkTypeOptionId: area.sinkTypeOptionId || null,
      sinkTypeText: area.sinkTypeText || null,
      sinkQty: area.sinkQty != null && area.sinkQty !== "" ? Number(area.sinkQty) : null,
      faucetText: area.faucetText || null,
      stoneName: area.stoneName || null,
      stoneThickness: (area.stoneThickness as any) || null,
      whNumber: area.whNumber || null,
      backsplashHas: Boolean(area.backsplashHas),
      backsplashIn: area.backsplashHas && area.backsplashIn ? toNumber(area.backsplashIn) : null,
      slabSupplierId: area.slabSupplierId || null,
      slabSupplierCustomName: area.slabSupplierCustomName || null,
      slabAreaLabel:
        calcInput.slabLengthIn && calcInput.slabWidthIn
          ? `1) ${calcInput.slabLengthIn} X ${calcInput.slabWidthIn} = ${result.slabPieceSqft.toFixed(2)}`
          : null,
      slabQty: calcInput.slabQty,
      slabRecommendedQty: result.slabRecommendedQty,
      slabQtyFlagged: result.slabQtyFlagged,
      slabTypeId: area.slabTypeId || null,
      slabAmount: calcInput.slabAmount,
      jobSqft: result.jobSqft,
      labor: result.labor,
      buildUp: result.buildUp,
      sinkCutoutOptionId: area.sinkCutoutOptionId || null,
      sinkCutoutQty: calcInput.sinkCutoutQty,
      sinkCutoutTotal: result.sinkCutoutTotal,
      cooktopOptionId: area.cooktopOptionId || null,
      cooktopQty: calcInput.cooktopQty,
      cooktopTotal: result.cooktopTotal,
      bumpOutOptionId: area.bumpOutOptionId || null,
      bumpOutQty: calcInput.bumpOutQty,
      bumpOutTotal: result.bumpOutTotal,
      cuttingBoardOptionId: area.cuttingBoardOptionId || null,
      cuttingBoardQty: calcInput.cuttingBoardQty,
      cuttingBoardTotal: result.cuttingBoardTotal,
      windowsillOptionId: area.windowsillOptionId || null,
      windowsillTotal: result.windowsillTotal,
      powerStationOptionId: area.powerStationOptionId || null,
      powerStationTotal: result.powerStationTotal,
      otherChargeOptionId: hasCustomOtherCharge ? null : area.otherChargeOptionId || null,
      otherChargeCustomName: hasCustomOtherCharge ? area.otherChargeCustomName!.trim() : null,
      otherChargeCustomPrice: hasCustomOtherCharge ? toNumber(area.otherChargeCustomPrice) : null,
      otherChargeTotal: result.otherChargeTotal,
      removalOptionId: area.removalOptionId || null,
      removalTotal: result.removalTotal,
      leftoverNote: area.leftoverNote || null,
      areaTotal: result.areaTotal,
      drawingMode: area.drawingMode === "IMAGE" ? "IMAGE" : "CANVAS",
      canvasData: area.canvasData ?? undefined,
      sections: {
        create: sections.map((s) => ({
          edgeTypeId: s.edgeTypeId,
          sqftTotal: s.rows.reduce((sum, r) => {
            if (r.lengthIn <= 0 || r.widthIn <= 0) return sum;
            return sum + (r.lengthIn * r.widthIn) / 144;
          }, 0),
          sortOrder: s.sortOrder,
          rows: {
            create: s.rows.map((r) => ({
              lengthIn: r.lengthIn,
              widthIn: r.widthIn,
              sqft: r.lengthIn > 0 && r.widthIn > 0 ? (r.lengthIn * r.widthIn) / 144 : 0,
              sortOrder: r.sortOrder,
            })),
          },
        })),
      },
    },
    areaTotal: result.areaTotal,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const salesRep = searchParams.get("salesRep")?.trim();
  const status = searchParams.get("status") || "active"; // active | archived | all

  const where: any = {};
  if (status === "active") where.isActive = true;
  if (status === "archived") where.isActive = false;
  if (salesRep) where.salesRep = salesRep;
  if (q) {
    where.OR = [
      { clientName: { contains: q, mode: "insensitive" } },
      { orderNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const orders = await prismaAny.fabricationOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      areas: { select: { id: true, name: true, areaTotal: true } },
      createdBy: { select: { name: true, email: true } },
    },
    take: 500,
  });

  return NextResponse.json(
    orders.map((order: any) => ({
      ...order,
      total: toNumber(order.total),
      areas: order.areas.map((a: any) => ({ ...a, areaTotal: toNumber(a.areaTotal) })),
    })),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const clientName = String(body.clientName || "").trim();
    const salesRep = String(body.salesRep || "").trim();
    const areasPayload: AreaPayload[] = Array.isArray(body.areas)
      ? body.areas
      : [];

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }
    if (areasPayload.length === 0) {
      return NextResponse.json(
        { error: "Add at least one area before saving." },
        { status: 400 },
      );
    }

    const maps = await loadSettingsMaps();
    const built = areasPayload.map((area) => buildAreaCreateData(area, maps));
    const resolved = await Promise.all(built);
    const orderTotal = resolved.reduce((sum, r) => sum + r.areaTotal, 0);

    const orderDate = body.date ? new Date(body.date) : new Date();

    // FO# is always server-generated — never trust a client-supplied value.
    const maxAttempts = 3;
    let order: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const orderNumber = await generateMonthlyFabOrderNumber();
      try {
        order = await prismaAny.fabricationOrder.create({
          data: {
            orderNumber,
            date: Number.isNaN(orderDate.getTime()) ? new Date() : orderDate,
            clientName,
            clientId: body.clientId || null,
            dealId: body.dealId || null,
            dealName: body.dealName || null,
            jobId: body.jobId || null,
            salesRep,
            notes: body.notes || null,
            total: orderTotal,
            createdById: auth.user.id,
            areas: {
              create: resolved.map((r) => r.data),
            },
          },
          include: { areas: { orderBy: { sortOrder: "asc" } } },
        });
        break;
      } catch (error: any) {
        if (isOrderNumberUniqueConstraintError(error) && attempt < maxAttempts) {
          continue;
        }
        throw error;
      }
    }
    if (!order) {
      throw new Error("Failed to generate a unique order number. Please try saving again.");
    }

    await prismaAny.fabricationOrderHistory.create({
      data: {
        orderId: order.id,
        action: "CREATED",
        changedById: auth.user.id,
      },
    });

    // Save any newly attached images now that areas have real IDs.
    for (let i = 0; i < order.areas.length; i += 1) {
      const areaPayload = areasPayload[i];
      const savedArea = order.areas[i];
      if (areaPayload?.images?.newImages?.length) {
        await saveOrderAreaImages(
          savedArea.id,
          areaPayload.images.newImages,
          auth.user.id,
        );
      }
      if (areaPayload?.images?.copyExisting?.length) {
        await copyOrderAreaImages(
          savedArea.id,
          areaPayload.images.copyExisting,
          auth.user.id,
        );
      }
    }

    // Best-effort: link this order into the Customers program's job
    // Documents list, mirroring how Payment Terms / Misc Estimates show up
    // there. Never let this fail the order save itself.
    const jobArtifactId = await syncFabricationOrderArtifact({
      orderId: order.id,
      jobArtifactId: null,
      jobId: body.jobId || null,
      orderNumber: order.orderNumber,
      clientName,
      dealName: body.dealName || null,
      total: orderTotal,
      userId: auth.user.id,
    });
    if (jobArtifactId) {
      await prismaAny.fabricationOrder
        .update({ where: { id: order.id }, data: { jobArtifactId } })
        .catch(() => {});
    }

    return NextResponse.json({ id: order.id, orderNumber: order.orderNumber }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create fabrication order", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save fabrication order" },
      { status: 500 },
    );
  }
}
