import { NextRequest, NextResponse } from "next/server";
import { Prisma, SalesCommissionDebtType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const salesRepId = request.nextUrl.searchParams.get("salesRepId")?.trim();
    const where: Prisma.SalesCommissionDebtLedgerWhereInput = salesRepId
      ? { salesRepId }
      : {};

    const rows = await prisma.salesCommissionDebtLedger.findMany({
      where,
      include: {
        period: true,
        salesRep: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const balanceByRep = new Map<string, number>();
    rows
      .slice()
      .reverse()
      .forEach((row) => {
        balanceByRep.set(row.salesRepId, Number(row.newBalance));
      });

    return NextResponse.json({
      rows,
      balances: Object.fromEntries(balanceByRep),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load debt ledger" },
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
    const salesRepId = String(body?.salesRepId || "").trim();
    const type = String(
      body?.type || "MANUAL_ADJUSTMENT",
    ) as SalesCommissionDebtType;
    const amount = Math.abs(n(body?.amount, 0));

    if (!salesRepId || !amount) {
      return NextResponse.json(
        { error: "salesRepId and amount are required" },
        { status: 400 },
      );
    }

    if (!Object.values(SalesCommissionDebtType).includes(type)) {
      return NextResponse.json(
        { error: "Invalid debt ledger type" },
        { status: 400 },
      );
    }

    const last = await prisma.salesCommissionDebtLedger.findFirst({
      where: { salesRepId },
      orderBy: [{ createdAt: "desc" }],
    });

    const previous = Number(last?.newBalance || 0);
    const signedAmount = type === "DEBT_DEDUCTED" ? -amount : amount;
    const nextBalance = previous + signedAmount;

    const row = await prisma.salesCommissionDebtLedger.create({
      data: {
        salesRepId,
        periodId: body?.periodId ? String(body.periodId) : null,
        type,
        amount: new Prisma.Decimal(amount),
        previousBalance: new Prisma.Decimal(previous),
        newBalance: new Prisma.Decimal(nextBalance),
        notes:
          typeof body?.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : null,
        createdByUserId: access.userId,
      },
      include: {
        period: true,
        salesRep: true,
      },
    });

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "DEBT",
        entityId: row.id,
        fieldName: type,
        oldValue: previous,
        newValue: nextBalance,
        notes: row.notes,
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({ row });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to add debt ledger row" },
      { status: 500 },
    );
  }
}
