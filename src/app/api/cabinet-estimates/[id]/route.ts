import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import {
  computeCabinetsTotal,
  computeCabinetEstimateFooterTotals,
  computeDiscountAmount,
  computeLineItemsCustomizationSurchargeTotal,
  computeSpecialCustomizationLineAmount,
  computeBaseInstallationAmount,
  computeRemovalAmount,
  round2,
} from "@/lib/cabinetEstimateCalc";
import {
  getCabinetEstimateParameters,
  resolveInstallationType,
  resolveRemovalType,
  installationServiceItemPricesById,
  computeMicrowaveInstallationAmount,
  resolveDiscountPercent,
} from "@/lib/cabinetEstimateParameters";
import { getProgramVersion } from "@/lib/cabinetProgramVersion";
import {
  generateMonthlyCabinetEstimateNumber,
  isEstimateNumberUniqueConstraintError,
} from "@/lib/cabinetEstimateNumber";
import { estimateSignature } from "@/lib/cabinetEstimateSignature";
import { computeEstimateChanges } from "@/lib/cabinetEstimateChanges";
import { isPriceLockExpired } from "@/lib/cabinetPriceLock";

const prismaAny = prisma as any;
async function requireCreator() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("cabinetEstimates");
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
      originalEstimate: { select: { id: true, estimateNumber: true } },
      remeasureEstimates: { select: { id: true, estimateNumber: true } },
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

  const existing = await prismaAny.cabinetEstimate.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      specialCustomizationLines: true,
    },
  });
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
    const discountPercent = resolveDiscountPercent(
      parameters.discountOptions,
      body.discountPercent,
    );
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
    const microwaveInstallationAmount = computeMicrowaveInstallationAmount(
      Boolean(body.microwaveInstallation),
      parameters.installationServiceItems,
    );
    const installationAmount = round2(
      baseInstallationAmount * (resolvedInstallationType?.multiplier ?? 1) +
        microwaveInstallationAmount,
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

    // Did the user actually change anything? Compare a fingerprint of what is
    // being saved against what is stored (including the recomputed total, so a
    // price/parameter change that moves the number counts too).
    const programVersion = await getProgramVersion(prismaAny);
    const signatureInput = {
      date: nextDate,
      customerName,
      customerId: body.customerId || null,
      jobId: body.jobId || null,
      jobName: body.jobName || null,
      jobAddress: body.jobAddress || null,
      dealId: body.dealId || null,
      dealName: body.dealName || null,
      salesRep,
      brand: body.brand || null,
      groupColor: body.groupColor || null,
      vendorId: body.vendorId || null,
      priceTierId: body.priceTierId || null,
      removalTypeId: resolvedRemovalType?.id || null,
      installationTypeId: resolvedInstallationType?.id || null,
      projectType: body.projectType || null,
      notes: body.notes || null,
      microwaveInstallation: Boolean(body.microwaveInstallation),
      discountPercent,
      total,
      lineItems: lineItemsData,
      specialCustomizationLines: specialCustomizationLinesData,
    };
    const signatureNew = estimateSignature(signatureInput);
    const signatureOld = estimateSignature({
      ...existing,
      lineItems: existing.lineItems,
      specialCustomizationLines: existing.specialCustomizationLines,
    });
    // Price lock: while the estimate's prices are still locked (younger than
    // PRICE_LOCK_DAYS), a shift in the recomputed total caused only by
    // parameter changes (installation rates, etc.) is not a user edit.
    const lockExpired = isPriceLockExpired(existing.pricedAt || existing.createdAt);
    let changed = signatureNew !== signatureOld;
    if (changed && !lockExpired) {
      const sameTotal = estimateSignature({ ...signatureInput, total: existing.total });
      if (sameTotal === signatureOld) changed = false;
    }

    if (!changed) {
      return NextResponse.json({
        id: existing.id,
        estimateNumber: existing.estimateNumber,
        unchanged: true,
      });
    }

    // What the user changed since the last save (shown in Estimate History).
    const changeRows = computeEstimateChanges(existing, {
      customerName,
      jobName: body.jobName || null,
      brand: body.brand || null,
      groupColor: body.groupColor || null,
      projectType: body.projectType || null,
      installationTypeName: resolvedInstallationType?.name || null,
      removal: resolvedRemovalType?.name || null,
      discountPercent,
      microwaveInstallation: Boolean(body.microwaveInstallation),
      notes: body.notes || null,
      total,
      lineItems: lineItemsData,
      specialCustomizationLines: specialCustomizationLinesData,
    });

    const commonData = {
      date: nextDate,
      customerName,
      customerId: body.customerId || null,
      jobId: body.jobId || null,
      jobName: body.jobName || null,
      jobAddress: body.jobAddress || null,
      email: existing.email || null, // no longer edited on the form - keep what was stored
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
    };
    const versionFields = {
      version: programVersion.public,
      versionActual: programVersion.actual,
      // Prices are refreshed from the price list once the lock has expired
      // (the form does that when it opens the estimate); otherwise the
      // original pricing date carries over.
      pricedAt: lockExpired ? new Date() : existing.pricedAt || existing.createdAt,
    };

    // A changed estimate gets a NEW Estimate # (the previous one is kept as
    // it is - it is no longer archived automatically - so the earlier version
    // can still be found). Remeasure estimates keep their <original>R number
    // and are updated in place.
    if (!existing.isRemeasure) {
      const maxAttempts = 3;
      let created: any = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const newNumber = await generateMonthlyCabinetEstimateNumber();
        try {
          created = await prismaAny.cabinetEstimate.create({
            data: {
              ...commonData,
              ...versionFields,
              estimateNumber: newNumber,
              isRemeasure: false,
              originalEstimateId: null,
              createdById: auth.user.id,
              lineItems: { create: lineItemsData },
              specialCustomizationLines: { create: specialCustomizationLinesData },
            },
          });
          break;
        } catch (error: any) {
          if (isEstimateNumberUniqueConstraintError(error) && attempt < maxAttempts) {
            continue;
          }
          throw error;
        }
      }
      if (!created) {
        throw new Error(
          "Failed to generate a unique estimate number. Please try saving again.",
        );
      }

      // Any remeasure of the old version now points at the new one.
      await prismaAny.cabinetEstimate.updateMany({
        where: { originalEstimateId: id },
        data: { originalEstimateId: created.id },
      });
      await prismaAny.cabinetEstimateHistory.create({
        data: {
          estimateId: created.id,
          action: "CREATED",
          fieldName: "revisionOf",
          oldValue: existing.estimateNumber,
          newValue: created.estimateNumber,
          changedById: auth.user.id,
        },
      });
      if (changeRows.length > 0) {
        await prismaAny.cabinetEstimateHistory.createMany({
          data: changeRows.map((row) => ({
            estimateId: created.id,
            action: "CHANGED",
            fieldName: row.fieldName,
            oldValue: row.oldValue,
            newValue: row.newValue,
            changedById: auth.user.id,
          })),
        });
      }
      await prismaAny.cabinetEstimateHistory.create({
        data: {
          estimateId: id,
          action: "REVISED",
          fieldName: "replacedBy",
          oldValue: existing.estimateNumber,
          newValue: created.estimateNumber,
          changedById: auth.user.id,
        },
      });

      return NextResponse.json({
        id: created.id,
        estimateNumber: created.estimateNumber,
        previousEstimateId: id,
        previousEstimateNumber: existing.estimateNumber,
        renumbered: true,
      });
    }

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
        ...commonData,
        ...versionFields,
        lineItems: { create: lineItemsData },
        specialCustomizationLines: { create: specialCustomizationLinesData },
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });

    if (changeRows.length > 0) {
      await prismaAny.cabinetEstimateHistory.createMany({
        data: changeRows.map((row) => ({
          estimateId: id,
          action: "CHANGED",
          fieldName: row.fieldName,
          oldValue: row.oldValue,
          newValue: row.newValue,
          changedById: auth.user.id,
        })),
      });
    } else {
      await prismaAny.cabinetEstimateHistory.create({
        data: {
          estimateId: id,
          action: "UPDATED",
          changedById: auth.user.id,
        },
      });
    }

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
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRoles.length === 0) {
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
