import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import {
  computeCabinetsTotal,
  computeCabinetEstimateFooterTotals,
} from "@/lib/cabinetEstimateCalc";
import {
  generateMonthlyCabinetEstimateNumber,
  isEstimateNumberUniqueConstraintError,
} from "@/lib/cabinetEstimateNumber";

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
};

export function buildLineItemsCreateData(lineItems: LineItemPayload[]) {
  return lineItems
    .map((item, index) => {
      const qty = toNumber(item.qty ?? 1) || 1;
      const unitPrice = toNumber(item.unitPrice);
      return {
        sortOrder: index,
        qty,
        code: item.code?.toString().trim() || null,
        description: item.description?.toString().trim() || null,
        isCustomization: Boolean(item.isCustomization),
        note: item.note?.toString().trim() || null,
        unitPrice,
        totalPrice: Math.round(qty * unitPrice * 100) / 100,
      };
    })
    .filter(
      (item) =>
        item.code || item.description || item.note || item.unitPrice !== 0,
    );
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
      isActive: true,
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

    const lineItemsData = buildLineItemsCreateData(lineItemsPayload);
    const cabinetsTotal = computeCabinetsTotal(
      lineItemsData.map((item) => ({ qty: item.qty, unitPrice: item.unitPrice })),
    );
    const discount = toNumber(body.discount);
    const removalAmount = toNumber(body.removalAmount);
    const installationAmount = toNumber(body.installationAmount);
    const customizationAmount = toNumber(body.customizationAmount);
    const { cabinetsSubtotal, total } = computeCabinetEstimateFooterTotals({
      cabinetsTotal,
      discount,
      removalAmount,
      installationAmount,
      customizationAmount,
    });

    const estimateDate = body.date ? new Date(body.date) : new Date();

    // Estimate # is always server-generated - never trust a client value.
    const maxAttempts = 3;
    let estimate: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const estimateNumber = await generateMonthlyCabinetEstimateNumber();
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
            email: body.email || null,
            dealId: body.dealId || null,
            dealName: body.dealName || null,
            salesRep,
            brand: body.brand || null,
            groupColor: body.groupColor || null,
            removal: body.removal || null,
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
            miscCabinetsCount: Math.max(
              0,
              Math.trunc(toNumber(body.miscCabinetsCount)),
            ),
            itemsQuantity: Math.max(0, Math.trunc(toNumber(body.itemsQuantity))),
            microwaveInstallation: Boolean(body.microwaveInstallation),
            cabinetsTotal,
            discount,
            cabinetsSubtotal,
            removalAmount,
            installationAmount,
            customizationLabel: body.customizationLabel || null,
            customizationAmount,
            total,
            notes: body.notes || null,
            createdById: auth.user.id,
            lineItems: { create: lineItemsData },
          },
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        });
        break;
      } catch (error: any) {
        if (
          isEstimateNumberUniqueConstraintError(error) &&
          attempt < maxAttempts
        ) {
          continue;
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
        changedById: auth.user.id,
      },
    });

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
