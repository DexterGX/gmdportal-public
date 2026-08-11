import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { computeAreaTotals, type CalcAreaInput } from "@/lib/fabricationCalc";
import { saveOrderAreaImages, deleteOrderAreaImages } from "@/lib/fabricationImages";
import { syncFabricationOrderArtifact } from "@/lib/fabricationOrderArtifact";

const prismaAny = prisma as any;
const CREATE_ROLES = ["admin", "sales", "office"];

async function requireCreator() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!CREATE_ROLES.includes(appRole)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user, appRole };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  };
}

function resolveArea(area: any, maps: Awaited<ReturnType<typeof loadSettingsMaps>>) {
  const sections = (area.sections || []).map((section: any) => {
    const edgeType = section.edgeTypeId ? maps.edgeTypes.get(section.edgeTypeId) : null;
    return {
      edgeTypeId: section.edgeTypeId || null,
      isBuildUp: Boolean(edgeType?.isBuildUp),
      pricePerSqft: toNumber(edgeType?.pricePerSqft),
      sortOrder: section.sortOrder ?? 0,
      rows: (section.rows || []).map((row: any, idx: number) => ({
        lengthIn: toNumber(row.lengthIn),
        widthIn: toNumber(row.widthIn),
        sortOrder: row.sortOrder ?? idx,
      })),
    };
  });

  const slabType = area.slabTypeId ? maps.slabTypes.get(area.slabTypeId) : null;
  const sinkCutout = area.sinkCutoutOptionId ? maps.sinkCutouts.get(area.sinkCutoutOptionId) : null;
  const cooktop = area.cooktopOptionId ? maps.cooktops.get(area.cooktopOptionId) : null;
  const bumpOut = area.bumpOutOptionId ? maps.bumpOuts.get(area.bumpOutOptionId) : null;
  const cuttingBoard = area.cuttingBoardOptionId ? maps.cuttingBoards.get(area.cuttingBoardOptionId) : null;
  const windowsill = area.windowsillOptionId ? maps.windowsills.get(area.windowsillOptionId) : null;
  const powerStation = area.powerStationOptionId ? maps.powerStations.get(area.powerStationOptionId) : null;
  const otherCharge = area.otherChargeOptionId ? maps.otherCharges.get(area.otherChargeOptionId) : null;
  const removal = area.removalOptionId ? maps.removals.get(area.removalOptionId) : null;
  const hasCustomOtherCharge = Boolean(area.otherChargeCustomName?.trim());
  const otherChargePrice = hasCustomOtherCharge
    ? toNumber(area.otherChargeCustomPrice)
    : toNumber(otherCharge?.price);

  const calcInput: CalcAreaInput = {
    sections: sections.map((s: any) => ({
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

  const scalarData = {
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
  };

  const sectionsCreate = sections.map((s: any) => ({
    edgeTypeId: s.edgeTypeId,
    sqftTotal: s.rows.reduce((sum: number, r: any) => {
      if (r.lengthIn <= 0 || r.widthIn <= 0) return sum;
      return sum + (r.lengthIn * r.widthIn) / 144;
    }, 0),
    sortOrder: s.sortOrder,
    rows: {
      create: s.rows.map((r: any) => ({
        lengthIn: r.lengthIn,
        widthIn: r.widthIn,
        sqft: r.lengthIn > 0 && r.widthIn > 0 ? (r.lengthIn * r.widthIn) / 144 : 0,
        sortOrder: r.sortOrder,
      })),
    },
  }));

  return { scalarData, sectionsCreate, areaTotal: result.areaTotal };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const order = await prismaAny.fabricationOrder.findUnique({
    where: { id },
    include: {
      areas: {
        orderBy: { sortOrder: "asc" },
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: { rows: { orderBy: { sortOrder: "asc" } } },
          },
          images: { orderBy: { uploadedAt: "asc" } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  try {
    const body = await request.json();
    const clientName = String(body.clientName || "").trim();
    const salesRep = String(body.salesRep || "").trim();
    const areasPayload: any[] = Array.isArray(body.areas) ? body.areas : [];

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }
    if (areasPayload.length === 0) {
      return NextResponse.json(
        { error: "Add at least one area before saving." },
        { status: 400 },
      );
    }

    const existing = await prismaAny.fabricationOrder.findUnique({
      where: { id },
      include: { areas: { include: { images: { select: { id: true } } } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const maps = await loadSettingsMaps();
    const resolvedAreas = areasPayload.map((area) => ({
      payload: area,
      ...resolveArea(area, maps),
    }));
    const orderTotal = resolvedAreas.reduce((sum, r) => sum + r.areaTotal, 0);

    const existingAreaIds = new Set(existing.areas.map((a: any) => a.id));
    const payloadAreaIds = new Set(
      areasPayload.filter((a) => a.id).map((a) => a.id),
    );
    const areasToDelete = existing.areas.filter((a: any) => !payloadAreaIds.has(a.id));

    const historyEntries: any[] = [];

    if (existing.clientName !== clientName) {
      historyEntries.push({
        orderId: id,
        action: "UPDATED",
        fieldName: "clientName",
        oldValue: existing.clientName,
        newValue: clientName,
        changedById: auth.user.id,
      });
    }
    if (existing.salesRep !== salesRep) {
      historyEntries.push({
        orderId: id,
        action: "UPDATED",
        fieldName: "salesRep",
        oldValue: existing.salesRep,
        newValue: salesRep,
        changedById: auth.user.id,
      });
    }
    if ((existing.notes || "") !== (body.notes || "")) {
      historyEntries.push({
        orderId: id,
        action: "UPDATED",
        fieldName: "notes",
        oldValue: existing.notes || "",
        newValue: body.notes || "",
        changedById: auth.user.id,
      });
    }
    if (Math.abs(toNumber(existing.total) - orderTotal) > 0.01) {
      historyEntries.push({
        orderId: id,
        action: "UPDATED",
        fieldName: "total",
        oldValue: String(toNumber(existing.total)),
        newValue: String(orderTotal),
        changedById: auth.user.id,
      });
    }
    for (const area of areasToDelete) {
      historyEntries.push({
        orderId: id,
        action: "UPDATED",
        fieldName: "area removed",
        oldValue: area.name,
        newValue: null,
        changedById: auth.user.id,
      });
    }
    for (const r of resolvedAreas) {
      const existingArea = r.payload.id
        ? existing.areas.find((a: any) => a.id === r.payload.id)
        : null;
      if (!existingArea) {
        historyEntries.push({
          orderId: id,
          action: "UPDATED",
          fieldName: "area added",
          oldValue: null,
          newValue: r.scalarData.name,
          changedById: auth.user.id,
        });
      } else if (Math.abs(toNumber(existingArea.areaTotal) - r.areaTotal) > 0.01) {
        historyEntries.push({
          orderId: id,
          action: "UPDATED",
          fieldName: `area total (${r.scalarData.name})`,
          oldValue: String(toNumber(existingArea.areaTotal)),
          newValue: String(r.areaTotal),
          changedById: auth.user.id,
        });
      }
    }

    // Best-effort remove storage files for deleted areas' images.
    for (const area of areasToDelete) {
      const imageIds = (area.images || []).map((img: any) => img.id);
      if (imageIds.length) {
        await deleteOrderAreaImages(imageIds).catch(() => {});
      }
    }

    await prisma.$transaction(async (tx: any) => {
      if (areasToDelete.length) {
        await tx.fabricationOrderArea.deleteMany({
          where: { id: { in: areasToDelete.map((a: any) => a.id) } },
        });
      }

      for (const r of resolvedAreas) {
        if (r.payload.id && existingAreaIds.has(r.payload.id)) {
          await tx.fabricationAreaSection.deleteMany({
            where: { areaId: r.payload.id },
          });
          await tx.fabricationOrderArea.update({
            where: { id: r.payload.id },
            data: {
              ...r.scalarData,
              sections: { create: r.sectionsCreate },
            },
          });
        } else {
          const created = await tx.fabricationOrderArea.create({
            data: {
              ...r.scalarData,
              orderId: id,
              sections: { create: r.sectionsCreate },
            },
          });
          r.payload.__newId = created.id;
        }
      }

      const orderDate = body.date ? new Date(body.date) : undefined;

      await tx.fabricationOrder.update({
        where: { id },
        data: {
          // orderNumber is intentionally omitted — FO# is assigned once at
          // creation and never changes on update.
          ...(orderDate && !Number.isNaN(orderDate.getTime()) ? { date: orderDate } : {}),
          clientName,
          clientId: body.clientId || null,
          dealId: body.dealId || null,
          dealName: body.dealName || null,
          jobId: body.jobId || null,
          salesRep,
          notes: body.notes || null,
          total: orderTotal,
        },
      });

      if (historyEntries.length) {
        await tx.fabricationOrderHistory.createMany({ data: historyEntries });
      }
    });

    // Image adds/removals (outside transaction - involves external storage calls).
    for (const r of resolvedAreas) {
      const areaId = r.payload.id || r.payload.__newId;
      if (!areaId) continue;
      const images = r.payload.images || {};
      if (Array.isArray(images.newImages) && images.newImages.length) {
        await saveOrderAreaImages(areaId, images.newImages, auth.user.id);
      }
      if (r.payload.id) {
        const keepIds: string[] = Array.isArray(images.keepIds) ? images.keepIds : [];
        const existingArea = existing.areas.find((a: any) => a.id === r.payload.id);
        const toRemove = (existingArea?.images || [])
          .map((img: any) => img.id)
          .filter((imgId: string) => !keepIds.includes(imgId));
        if (toRemove.length) {
          await deleteOrderAreaImages(toRemove);
        }
      }
    }

    // Best-effort: keep this order's Customers-program Documents link in
    // sync (create it if a job/deal is now set, move/update it if the
    // job/deal changed, or remove it if the job/deal was cleared).
    const jobArtifactId = await syncFabricationOrderArtifact({
      orderId: id,
      jobArtifactId: existing.jobArtifactId || null,
      jobId: body.jobId || null,
      orderNumber: existing.orderNumber,
      clientName,
      dealName: body.dealName || null,
      total: orderTotal,
      userId: auth.user.id,
    });
    if (jobArtifactId !== (existing.jobArtifactId || null)) {
      await prismaAny.fabricationOrder
        .update({ where: { id }, data: { jobArtifactId } })
        .catch(() => {});
    }

    return NextResponse.json({ id });
  } catch (error: any) {
    console.error("Failed to update fabrication order", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update fabrication order" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (appRole !== "admin") {
    return NextResponse.json(
      { error: "Only admins can permanently delete a fabrication order." },
      { status: 403 },
    );
  }
  const { id } = await context.params;

  const order = await prismaAny.fabricationOrder.findUnique({
    where: { id },
    include: { areas: { include: { images: { select: { id: true } } } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allImageIds = order.areas.flatMap((a: any) => a.images.map((img: any) => img.id));
  if (allImageIds.length) {
    await deleteOrderAreaImages(allImageIds).catch(() => {});
  }

  await prismaAny.fabricationOrder.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
