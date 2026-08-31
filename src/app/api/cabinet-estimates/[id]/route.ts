import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import {
  computeCabinetsTotal,
  computeCabinetEstimateFooterTotals,
} from "@/lib/cabinetEstimateCalc";

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

function buildLineItemsCreateData(lineItems: LineItemPayload[]) {
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
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
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

    const parsedDate = body.date ? new Date(body.date) : existing.date;
    const nextDate = Number.isNaN(parsedDate?.getTime?.())
      ? existing.date
      : parsedDate;

    // Simplest correct approach for v1: replace all line items rather than
    // diffing them - there's no per-line history requirement yet.
    await prismaAny.cabinetEstimateLineItem.deleteMany({
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
        lineItems: { create: lineItemsData },
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
