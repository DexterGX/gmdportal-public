import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session;
}

// GET /api/sales-commission/weeks — list all weeks (non-draft for periods page)
// GET /api/sales-commission/weeks?status=APPROVED — get approved week
export async function GET(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const includeInvoices = searchParams.get("includeInvoices") === "true";

  const where: Record<string, any> = {};
  if (status) where.status = status;

  const weeks = await p.cMSWeek.findMany({
    where,
    orderBy: { weekStart: "desc" },
    include: includeInvoices
      ? {
          invoices: {
            orderBy: [{ sortOrder: "asc" }, { salesRep: "asc" }],
          },
        }
      : undefined,
  });

  return NextResponse.json(weeks);
}

// POST /api/sales-commission/weeks — create a new draft week
export async function POST(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { weekStart, weekEnd, checkDate, notes } = body;

  if (!weekStart || !weekEnd || !checkDate) {
    return NextResponse.json(
      { error: "weekStart, weekEnd, and checkDate are required" },
      { status: 400 },
    );
  }

  // Only one DRAFT or REVIEW at a time
  const existing = await p.cMSWeek.findFirst({
    where: { status: { in: ["DRAFT", "REVIEW"] } },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "There is already an active draft or review week. Please complete it first.",
      },
      { status: 409 },
    );
  }

  // Get the latest APPROVED week's invoices to carry over unpaid ones
  const latestApproved = await p.cMSWeek.findFirst({
    where: { status: "APPROVED" },
    orderBy: { weekStart: "desc" },
    include: { invoices: true },
  });

  const week = await p.cMSWeek.create({
    data: {
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd),
      checkDate: new Date(checkDate),
      status: "DRAFT",
      notes: notes || null,
    },
  });

  // Carry over unpaid invoices from previous approved week
  if (latestApproved?.invoices?.length) {
    const toCarry = latestApproved.invoices
      .filter(
        (inv: any) =>
          !inv.secondPaid &&
          !inv.paySecond &&
          !(inv.status === "BOTH_PAYMENTS"),
      )
      .sort((a: any, b: any) => {
        const repCompare = String(a.salesRep ?? "").localeCompare(
          String(b.salesRep ?? ""),
        );
        if (repCompare !== 0) return repCompare;
        return String(a.invoiceNumber ?? "").localeCompare(
          String(b.invoiceNumber ?? ""),
          undefined,
          { numeric: true },
        );
      });

    if (toCarry.length > 0) {
      await p.cMSInvoice.createMany({
        data: toCarry.map((inv: any, idx: number) => ({
          weekId: week.id,
          salesRep: inv.salesRep,
          invoiceDate: inv.invoiceDate,
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customer,
          commissionRate: inv.commissionRate,
          amount: inv.amount,
          calculatedCommission: inv.calculatedCommission,
          firstPaymentAmount: inv.firstPaymentAmount,
          secondPaymentAmount: inv.secondPaymentAmount,
          payFirst: false,
          paySecond: false,
          firstPaid: inv.firstPaid || inv.payFirst,
          firstPaidDate: inv.firstPaid
            ? inv.firstPaidDate
            : inv.payFirst
              ? new Date(latestApproved.checkDate)
              : null,
          secondPaid: false,
          secondPaidDate: null,
          thirdPartyAmount: inv.thirdPartyAmount,
          refundAmount: inv.refundAmount,
          notes: inv.notes,
          isNew: false,
          status: inv.firstPaid || inv.payFirst ? "FIRST_PAID" : "PENDING",
          originalInvoiceId: inv.originalInvoiceId ?? inv.id,
          sortOrder: idx,
        })),
      });
    }
  }

  const fullWeek = await p.cMSWeek.findUnique({
    where: { id: week.id },
    include: {
      invoices: { orderBy: [{ sortOrder: "asc" }, { salesRep: "asc" }] },
    },
  });

  return NextResponse.json(fullWeek, { status: 201 });
}

// PATCH /api/sales-commission/weeks
export async function PATCH(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const week = await p.cMSWeek.findUnique({
    where: { id: body.id },
    include: { invoices: true },
  });

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  if (body.status === "APPROVED") {
    // Persist this week's payment checks as paid flags before closing invoices.
    await p.cMSInvoice.updateMany({
      where: {
        weekId: week.id,
        payFirst: true,
        firstPaid: false,
      },
      data: {
        firstPaid: true,
        firstPaidDate: week.checkDate,
      },
    });

    await p.cMSInvoice.updateMany({
      where: {
        weekId: week.id,
        paySecond: true,
        secondPaid: false,
      },
      data: {
        secondPaid: true,
        secondPaidDate: week.checkDate,
      },
    });

    const refreshedWeek = await p.cMSWeek.findUnique({
      where: { id: week.id },
      include: { invoices: true },
    });

    const closedInvoices = (refreshedWeek?.invoices ?? []).filter(
      (invoice: any) => invoice.firstPaid && invoice.secondPaid,
    );
    if (closedInvoices.length > 0) {
      await p.cMSClosedInvoice.createMany({
        data: closedInvoices.map((invoice: any) => ({
          salesRep: invoice.salesRep,
          invoiceDate: invoice.invoiceDate,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer,
          commissionRate: invoice.commissionRate,
          amount: invoice.amount,
          calculatedCommission: invoice.calculatedCommission,
          firstPaymentAmount: invoice.firstPaymentAmount,
          secondPaymentAmount: invoice.secondPaymentAmount,
          thirdPartyAmount: invoice.thirdPartyAmount,
          refundAmount: invoice.refundAmount,
          firstPaidDate: invoice.firstPaidDate,
          secondPaidDate: invoice.secondPaidDate,
          notes: invoice.notes,
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          checkDate: week.checkDate,
          originalInvoiceId: invoice.originalInvoiceId ?? invoice.id,
        })),
      });

      await p.cMSInvoice.deleteMany({
        where: { id: { in: closedInvoices.map((invoice: any) => invoice.id) } },
      });
    }
  }

  const updated = await p.cMSWeek.update({
    where: { id: week.id },
    data: {
      status: body.status ?? week.status,
      notes: body.notes ?? week.notes,
    },
    include: { invoices: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/sales-commission/weeks?id=...
export async function DELETE(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const week = await p.cMSWeek.findUnique({ where: { id } });
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  // Invoices cascade delete via relation.
  await p.cMSWeek.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
