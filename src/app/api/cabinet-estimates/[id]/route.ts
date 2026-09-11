import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import {
  computeCabinetsTotal,
  computeCabinetEstimateFooterTotals,
  computeDiscountAmount,
  computeLineItemsCustomizationSurchargeTotal,
  computeSpecialCustomizationLineAmount,
  computeBaseInstallationAmount,
  computeRemovalAmount,
  round2,
  DISCOUNT_PERCENT_OPTIONS,
} from "@/lib/cabinetEstimateCalc";
import {
  getCabinetEstimateParameters,
  resolveInstallationType,
  resolveRemovalType,
  installationServiceItemPricesById,
} from "@/lib/cabinetEstimateParameters";

const prismaAny = prisma as any;
const CREATE_ROLES = ["admin", "sales", "office", "finance"];

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

type LineItemPayload = {
  qty?: number | string;
  code?: string | null;
  description?: string | null;
  isCustomization?: boolean;
  note?: string | null;
  unitPrice?: number | string;
  catalogItemId?: string | null;
  summaryBucket?: string | null;
  installationItemId?: string | null;
};

const SUMMARY_BUCKETS = ["STANDARD", "DOUBLE", "CUSTOM", "MISC"];
function toSummaryBucket(value: unknown): string | null {
  return typeof value === "string" && SUMMARY_BUCKETS.includes(value) ? value : null;
}

function buildLineItemsCreateData(
  lineItems: LineItemPayload[],
  customSurchargePercent: number,
) {
  return lineItems
    .map((item, index) => {
      const qty = toNumber(item.qty ?? 0);
      const unitPrice = toNumber(item.unitPrice);
      const isCustomization = Boolean(item.isCustomization);
      // The Custom column is just a checkbox (round 9) - the surcharge % is
      // never typed per line, it's always whatever GMD Parameters currently
      // says, stamped here server-side.
      const customizationType = isCustomization ? "percent" : null;
      const customizationValue = isCustomization ? customSurchargePercent : 0;
      return {
        sortOrder: index,
        qty,
        code: item.code?.toString().trim() || null,
        description: item.description?.toString().trim() || null,
        isCustomization,
        customizationType,
        customizationValue,
        note: item.note?.toString().trim() || null,
        unitPrice,
        totalPrice: Math.round(qty * unitPrice * 100) / 100,
        catalogItemId: item.catalogItemId || null,
        summaryBucket: toSummaryBucket(item.summaryBucket),
        installationItemId: item.installationItemId || null,
      };
    })
    .filter(
      (item) =>
        item.code || item.description || item.note || item.unitPrice !== 0,
    );
}

type SpecialCustomizationLinePayload = {
  itemId?: string;
  qty?: number | string;
};

async function buildSpecialCustomizationLinesData(
  lines: SpecialCustomizationLinePayload[],
) {
  const itemIds = [...new Set(lines.map((l) => l.itemId).filter(Boolean))] as string[];
  if (itemIds.length === 0) return [];

  const catalogItems = await prismaAny.cabinetSpecialCustomizationItem.findMany({
    where: { id: { in: itemIds } },
  });
  const catalogById = new Map(catalogItems.map((item: any) => [item.id, item]));

  return lines
    .map((line) => {
      const qty = toNumber(line.qty);
      const catalogItem = line.itemId ? catalogById.get(line.itemId) : null;
      if (!catalogItem || qty <= 0) return null;
      const price = toNumber((catalogItem as any).price);
      return {
        itemId: line.itemId as string,
        qty,
        amount: computeSpecialCustomizationLineAmount(qty, price),
      };
    })
    .filter((line): line is { itemId: string; qty: number; amount: number } => line !== null);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const estimate = await prismaAny.cabinetEstimate.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      specialCustomizationLines: {
        include: { item: true },
        orderBy: { item: { sortOrder: "asc" } },
      },
    },
  });
  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...estimate,
    cabinetsTotal: toNumber(estimate.cabinetsTotal),
    discount: toNumber(estimate.discount),
    cabinetsSubtotal: toNumber(estimate.cabinetsSubtotal),
    removalAmount: toNumber(estimate.removalAmount),
    installationAmount: toNumber(estimate.installationAmount),
    customizationAmount: toNumber(estimate.customizationAmount),
    total: toNumber(estimate.total),
    lineItems: estimate.lineItems.map((item: any) => ({
      ...item,
      qty: toNumber(item.qty),
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      customizationValue: toNumber(item.customizationValue),
    })),
    specialCustomizationLines: estimate.specialCustomizationLines.map((line: any) => ({
      itemId: line.itemId,
      qty: toNumber(line.qty),
      amount: toNumber(line.amount),
      name: line.item?.name || "",
      price: toNumber(line.item?.price),
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.cabinetEstimate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const customerName = String(body.customerName || "").trim();
    const salesRep = String(body.salesRep || "").trim();
    const lineItemsPayload: LineItemPayload[] = Array.isArray(body.lineItems)
      ? body.lineItems
      : [];

    if (!customerName) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 },
      );
    }
    if (!salesRep) {
      return NextResponse.json(
        { error: "Salesperson is required" },
        { status: 400 },
      );
    }

    // GMD Parameters are always fetched fresh and are the sole authority for
    // every dollar Installation computes to - never trust anything the
    // client sent for installationAmount or a line's customization %.
    const parameters = await getCabinetEstimateParameters(prismaAny);
    const lineItemsData = buildLineItemsCreateData(
      lineItemsPayload,
      parameters.settings.customSurchargePercent,
    );
    const cabinetsTotal = computeCabinetsTotal(
      lineItemsData.map((item) => ({ qty: item.qty, unitPrice: item.unitPrice })),
    );
    const discountPercent = DISCOUNT_PERCENT_OPTIONS.includes(
      Math.trunc(toNumber(body.discountPercent)) as any,
    )
      ? Math.trunc(toNumber(body.discountPercent))
      : 0;
    const discount = computeDiscountAmount(cabinetsTotal, discountPercent);
    // Round 12: Removal is no longer a client-typed dollar amount - it's
    // resolved the same way Installation Type is (never trust an
    // arbitrary client id) and the $ amount is always a percent of
    // cabinetsTotal (pre-discount), computed server-side.
    const resolvedRemovalType = resolveRemovalType(
      parameters.removalTypes,
      body.removalTypeId,
    );
    const removalAmount = computeRemovalAmount(
      cabinetsTotal,
      resolvedRemovalType?.percent,
    );
    const resolvedInstallationType = resolveInstallationType(
      parameters.installationTypes,
      body.installationTypeId,
    );
    const baseInstallationAmount = computeBaseInstallationAmount({
      cabinetsTotal,
      lineItems: lineItemsData.map((item) => ({
        qty: item.qty,
        unitPrice: item.unitPrice,
        installationItemId: item.installationItemId,
      })),
      installationServiceItemPrices: installationServiceItemPricesById(parameters.installationServiceItems),
      calcMode: parameters.settings.installationCalcMode,
      basePercent: parameters.settings.installationBasePercent,
    });
    const installationAmount = round2(
      baseInstallationAmount * (resolvedInstallationType?.multiplier ?? 1),
    );
    const specialCustomizationPayload: SpecialCustomizationLinePayload[] = Array.isArray(
      body.specialCustomizationLines,
    )
      ? body.specialCustomizationLines
      : [];
    const specialCustomizationLinesData = await buildSpecialCustomizationLinesData(
      specialCustomizationPayload,
    );
    const customizationAmount = round2(
      specialCustomizationLinesData.reduce((sum, line) => sum + line.amount, 0),
    );
    const lineCustomizationSurchargeAmount = computeLineItemsCustomizationSurchargeTotal(
      lineItemsData.map((item) => ({
        qty: item.qty,
        unitPrice: item.unitPrice,
        isCustomization: item.isCustomization,
        customizationValue: item.customizationValue,
      })),
    );
    const { cabinetsSubtotal, total } = computeCabinetEstimateFooterTotals({
      cabinetsTotal,
      discount,
      removalAmount,
      installationAmount,
      customizationAmount,
      lineCustomizationSurchargeAmount,
    });

    const parsedDate = body.date ? new Date(body.date) : existing.date;
    const nextDate = Number.isNaN(parsedDate?.getTime?.())
      ? existing.date
      : parsedDate;

    // Simplest correct approach for v1: replace all line items (and
    // special customization lines) rather than diffing them - there's no
    // per-line history requirement yet.
    await prismaAny.cabinetEstimateLineItem.deleteMany({
      where: { estimateId: id },
    });
    await prismaAny.cabinetEstimateSpecialCustomizationLine.deleteMany({
      where: { estimateId: id },
    });

    const updated = await prismaAny.cabinetEstimate.update({
      where: { id },
      data: {
        date: nextDate,
        customerName,
        customerId: body.customerId || null,
        jobId: body.jobId || null,
        jobName: body.jobName || null,
        jobAddress: body.jobAddress || null,
        email: body.email || null,
        dealId: body.dealId || null,
        dealName: body.dealName || null,
        salesRep,
        brand: body.brand || null,
        groupColor: body.groupColor || null,
        vendorId: body.vendorId || null,
        priceTierId: body.priceTierId || null,
        installationTypeId: resolvedInstallationType?.id || null,
        installationTypeName: resolvedInstallationType?.name || null,
        removalTypeId: resolvedRemovalType?.id || null,
        removal: resolvedRemovalType?.name || null,
        projectType: body.projectType || null,
        version: body.version || null,
        standardCabinetsCount: Math.max(
          0,
          Math.trunc(toNumber(body.standardCabinetsCount)),
        ),
        doubleCabinetsCount: Math.max(
          0,
          Math.trunc(toNumber(body.doubleCabinetsCount)),
        ),
        customCabinetsCount: Math.max(
          0,
          Math.trunc(toNumber(body.customCabinetsCount)),
        ),
        miscCabinetsCount: Math.max(
          0,
          Math.trunc(toNumber(body.miscCabinetsCount)),
        ),
        itemsQuantity: Math.max(0, Math.trunc(toNumber(body.itemsQuantity))),
        microwaveInstallation: Boolean(body.microwaveInstallation),
        cabinetsTotal,
        discountPercent,
        discount,
        cabinetsSubtotal,
        removalAmount,
        installationAmount,
        customizationLabel: null,
        customizationAmount,
        total,
        notes: body.notes || null,
        lineItems: { create: lineItemsData },
        specialCustomizationLines: { create: specialCustomizationLinesData },
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });

    await prismaAny.cabinetEstimateHistory.create({
      data: {
        estimateId: id,
        action: "UPDATED",
        changedById: auth.user.id,
      },
    });

    return NextResponse.json({
      id: updated.id,
      estimateNumber: updated.estimateNumber,
    });
  } catch (error: any) {
    console.error("Failed to update cabinet estimate", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update cabinet estimate" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prismaAny.cabinetEstimate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prismaAny.cabinetEstimate.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
