import { NextRequest, NextResponse } from "next/server";
import { Prisma, SalesCommissionPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canManageFinalizedWeeks,
  requireSalesCommissionAccess,
} from "@/lib/salesCommissionAuth";
import { resolvePayWeek } from "@/lib/salesCommission";

function toDateOnly(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseLocalDateInput(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateOnly(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : toDateOnly(parsed);
}

async function closeCarryOverPaidInvoices(newPeriodId: string, userId: string) {
  const now = new Date();
  const result = await prisma.salesCommissionInvoice.updateMany({
    where: {
      periodId: {
        not: newPeriodId,
      },
      status: "SECOND_PAID",
    },
    data: {
      status: "CLOSED",
      closedAt: now,
      updatedByUserId: userId,
    },
  });

  if (result.count > 0) {
    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "PERIOD",
        entityId: newPeriodId,
        fieldName: "autoClosedCarryOverInvoices",
        oldValue: Prisma.JsonNull,
        newValue: {
          closedCount: result.count,
        },
        changedByUserId: userId,
      },
    });
  }
}

export async function GET() {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const periods = await prisma.salesCommissionPeriod.findMany({
      orderBy: [{ startDate: "desc" }],
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    return NextResponse.json({ periods });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load periods" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    if (!["admin", "finance"].includes(access.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const selectedDate = parseLocalDateInput(body?.selectedDate) || new Date();
    const salesRepScope = String(body?.salesRepScope || "ALL").trim() || "ALL";
    const checkDateInput = parseLocalDateInput(body?.checkDate);
    const payWeek = resolvePayWeek(selectedDate);

    const existing = await prisma.salesCommissionPeriod.findUnique({
      where: {
        startDate_endDate: {
          startDate: toDateOnly(payWeek.start),
          endDate: toDateOnly(payWeek.end),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ period: existing, existed: true });
    }

    const period = await prisma.salesCommissionPeriod.create({
      data: {
        startDate: toDateOnly(payWeek.start),
        endDate: toDateOnly(payWeek.end),
        checkDate: toDateOnly(checkDateInput || payWeek.checkDate),
        salesRepScope,
        status: "DRAFT",
        createdByUserId: access.userId,
        updatedByUserId: access.userId,
      },
    });

    await closeCarryOverPaidInvoices(period.id, access.userId);

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "PERIOD",
        entityId: period.id,
        fieldName: "created",
        oldValue: Prisma.JsonNull,
        newValue: {
          startDate: period.startDate,
          endDate: period.endDate,
          checkDate: period.checkDate,
          salesRepScope: period.salesRepScope,
          status: period.status,
        },
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({ period, existed: false });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create period" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    if (!["admin", "finance"].includes(access.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const periodId = String(body?.periodId || "").trim();
    const status = String(
      body?.status || "",
    ).trim() as SalesCommissionPeriodStatus;
    const reopenReason =
      typeof body?.reopenReason === "string" ? body.reopenReason.trim() : "";

    if (!periodId || !status) {
      return NextResponse.json(
        { error: "periodId and status are required" },
        { status: 400 },
      );
    }

    if (!Object.values(SalesCommissionPeriodStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid period status" },
        { status: 400 },
      );
    }

    const current = await prisma.salesCommissionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!current) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    if (
      current.status === "FINALIZED" &&
      !canManageFinalizedWeeks(access.appRole)
    ) {
      return NextResponse.json(
        { error: "Only admin users can change finalized weeks." },
        { status: 403 },
      );
    }

    if (status === "REOPENED" && !canManageFinalizedWeeks(access.appRole)) {
      return NextResponse.json(
        { error: "Only admin users can reopen finalized weeks." },
        { status: 403 },
      );
    }

    if (status === "REOPENED" && !reopenReason) {
      return NextResponse.json(
        { error: "Reopen reason is required." },
        { status: 400 },
      );
    }

    const updateData: Prisma.SalesCommissionPeriodUpdateInput = {
      status,
      updatedByUserId: access.userId,
    };

    if (status === "REVIEWED") {
      updateData.reviewedByUserId = access.userId;
      updateData.reviewedAt = new Date();
    }

    if (status === "FINALIZED") {
      updateData.finalizedByUserId = access.userId;
      updateData.finalizedAt = new Date();
    }

    if (status === "REOPENED") {
      updateData.reopenedByUserId = access.userId;
      updateData.reopenedAt = new Date();
      updateData.reopenReason = reopenReason;
    }

    if (status === "DRAFT") {
      updateData.reviewedByUserId = null;
      updateData.reviewedAt = null;
    }

    const updated = await prisma.salesCommissionPeriod.update({
      where: { id: periodId },
      data: updateData,
    });

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "PERIOD",
        entityId: updated.id,
        fieldName: "status",
        oldValue: current.status,
        newValue: updated.status,
        notes:
          status === "REOPENED" ? `Reopened reason: ${reopenReason}` : null,
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({ period: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update period" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    if (access.appRole !== "admin") {
      return NextResponse.json(
        { error: "Only admin users can delete weekly drafts." },
        { status: 403 },
      );
    }

    const periodId = request.nextUrl.searchParams.get("periodId")?.trim();
    if (!periodId) {
      return NextResponse.json(
        { error: "periodId is required" },
        { status: 400 },
      );
    }

    const current = await prisma.salesCommissionPeriod.findUnique({
      where: { id: periodId },
    });
    if (!current) {
      return NextResponse.json(
        { error: "Weekly commission not found" },
        { status: 404 },
      );
    }

    if (current.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only Draft weekly commissions can be deleted." },
        { status: 400 },
      );
    }

    await prisma.salesCommissionPeriod.delete({ where: { id: periodId } });

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "PERIOD",
        entityId: periodId,
        fieldName: "deletedDraft",
        oldValue: {
          startDate: current.startDate,
          endDate: current.endDate,
          checkDate: current.checkDate,
          status: current.status,
        },
        newValue: Prisma.JsonNull,
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete weekly draft" },
      { status: 500 },
    );
  }
}
