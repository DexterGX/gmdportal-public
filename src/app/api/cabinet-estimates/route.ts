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
  generateMonthlyCabinetEstimateNumber,
  isEstimateNumberUniqueConstraintError,
} from "@/lib/cabinetEstimateNumber";
import {
  getCabinetEstimateParameters,
  resolveInstallationType,
  resolveRemovalType,
  installationServiceItemPricesById,
  computeMicrowaveInstallationAmount,
  resolveDiscountPercent,
} from "@/lib/cabinetEstimateParameters";
import { getProgramVersion } from "@/lib/cabinetProgramVersion";
import { computeEstimateChanges } from "@/lib/cabinetEstimateChanges";

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

// Special Customization lines never carry a price of their own - the price
// always comes from the admin-managed catalog at save time, and only lines
// with a positive qty are persisted (mirrors how blank line-item rows are
// filtered out above).
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

export async function GET(request: NextRequest) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status") || "active"; // active | archived | all

  const where: any = {};
  if (status === "active") where.isActive = true;
  if (status === "archived") where.isActive = false;
  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { estimateNumber: { contains: q, mode: "insensitive" } },
      { jobName: { contains: q, mode: "insensitive" } },
      { dealName: { contains: q, mode: "insensitive" } },
    ];
  }

  const estimates = await prismaAny.cabinetEstimate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      estimateNumber: true,
      date: true,
      customerName: true,
      jobName: true,
      dealName: true,
      salesRep: true,
      brand: true,
      groupColor: true,
      isActive: true,
      isRemeasure: true,
      remeasureByName: true,
      total: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
    take: 500,
  });

  return NextResponse.json(
    estimates.map((estimate: any) => ({
      ...estimate,
      total: toNumber(estimate.total),
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

    // Remeasure PK List: a re-creation of an already-saved (sold) estimate by
    // the remeasure team. It is numbered <original number>R and points back
    // at the original; only one remeasure per original is allowed.
    let remeasureOriginal: any = null;
    if (body.isRemeasure) {
      if (!body.originalEstimateId) {
        return NextResponse.json(
          { error: "Open the saved estimate you want to remeasure first." },
          { status: 400 },
        );
      }
      remeasureOriginal = await prismaAny.cabinetEstimate.findUnique({
        where: { id: String(body.originalEstimateId) },
        include: { lineItems: true, specialCustomizationLines: true },
      });
      if (!remeasureOriginal || !remeasureOriginal.estimateNumber) {
        return NextResponse.json(
          { error: "The original estimate was not found." },
          { status: 404 },
        );
      }
      if (remeasureOriginal.isRemeasure) {
        return NextResponse.json(
          { error: "A remeasure estimate can't be remeasured again." },
          { status: 400 },
        );
      }
    }
    // Stamped server-side, never taken from the client.
    const programVersion = await getProgramVersion(prismaAny);

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

    const estimateDate = body.date ? new Date(body.date) : new Date();

    // Estimate # is always server-generated - never trust a client value.
    const maxAttempts = 3;
    let estimate: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const estimateNumber = remeasureOriginal
        ? `${remeasureOriginal.estimateNumber}R`
        : await generateMonthlyCabinetEstimateNumber();
      try {
        estimate = await prismaAny.cabinetEstimate.create({
          data: {
            estimateNumber,
            date: Number.isNaN(estimateDate.getTime())
              ? new Date()
              : estimateDate,
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
            installationTypeId: resolvedInstallationType?.id || null,
            installationTypeName: resolvedInstallationType?.name || null,
            removalTypeId: resolvedRemovalType?.id || null,
            removal: resolvedRemovalType?.name || null,
            projectType: body.projectType || null,
            version: programVersion.public,
            pricedAt: new Date(),
            versionActual: programVersion.actual,
            isRemeasure: Boolean(remeasureOriginal),
            originalEstimateId: remeasureOriginal?.id || null,
            remeasureByName: remeasureOriginal
              ? auth.user.name || auth.user.email || null
              : null,
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
            createdById: auth.user.id,
            lineItems: { create: lineItemsData },
            specialCustomizationLines: { create: specialCustomizationLinesData },
          },
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        });
        break;
      } catch (error: any) {
        if (isEstimateNumberUniqueConstraintError(error)) {
          if (remeasureOriginal) {
            return NextResponse.json(
              {
                error: `A remeasure estimate (${remeasureOriginal.estimateNumber}R) already exists for this estimate. Open it from Saved Estimates to edit it.`,
              },
              { status: 409 },
            );
          }
          if (attempt < maxAttempts) continue;
        }
        throw error;
      }
    }
    if (!estimate) {
      throw new Error(
        "Failed to generate a unique estimate number. Please try saving again.",
      );
    }

    await prismaAny.cabinetEstimateHistory.create({
      data: {
        estimateId: estimate.id,
        action: "CREATED",
        fieldName: remeasureOriginal ? "remeasureOf" : null,
        newValue: remeasureOriginal ? remeasureOriginal.estimateNumber : null,
        changedById: auth.user.id,
      },
    });

    // A remeasure usually changes the packing list (items added/removed, other
    // quantities, a new total) - record those differences against the original
    // estimate so the history shows what the remeasure changed.
    if (remeasureOriginal) {
      try {
        const remeasureChanges = computeEstimateChanges(remeasureOriginal, {
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
        if (remeasureChanges.length > 0) {
          await prismaAny.cabinetEstimateHistory.createMany({
            data: remeasureChanges.map((row) => ({
              estimateId: estimate.id,
              action: "CHANGED",
              fieldName: row.fieldName,
              oldValue: row.oldValue,
              newValue: row.newValue,
              changedById: auth.user.id,
            })),
          });
        }
      } catch (historyError) {
        // History is best-effort - never fail a save because of it.
        console.error("Failed to record remeasure changes", historyError);
      }
    }

    return NextResponse.json(
      { id: estimate.id, estimateNumber: estimate.estimateNumber },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Failed to create cabinet estimate", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save cabinet estimate" },
      { status: 500 },
    );
  }
}
