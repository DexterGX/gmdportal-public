import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/app/sales-commission/types";

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
        data: toCarry.map((inv: any, idx: number) => {
          const carriedFirstPaid = Boolean(inv.firstPaid || inv.payFirst);
          return {
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
            firstPaid: carriedFirstPaid,
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
            // Notes-driven holds (e.g. "No Deposit") always win, so an
            // invoice carried into a new draft week keeps the same
            // color/status it had before instead of silently resetting to
            // Open/1st Paid while the Notes field still shows the hold
            // reason.
            status: deriveInvoiceStatus({
              notes: inv.notes,
              payFirst: false,
              paySecond: false,
              firstPaid: carriedFirstPaid,
              secondPaid: false,
            }),
            originalInvoiceId: inv.originalInvoiceId ?? inv.id,
            sortOrder: idx,
          };
        }),
      });
    }
  }

  // Remove fully-paid invoices from all prior approved weeks now that a new
  // draft is starting. They are already captured in CMSClosedInvoice.
  const approvedWeeks = await p.cMSWeek.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });
  if (approvedWeeks.length > 0) {
    await p.cMSInvoice.deleteMany({
      where: {
        weekId: { in: approvedWeeks.map((w: any) => w.id) },
        firstPaid: true,
        secondPaid: true,
      },
    });
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
      // Upsert to closed list (skip duplicates by originalInvoiceId)
      const originalIds = closedInvoices.map(
        (invoice: any) => invoice.originalInvoiceId ?? invoice.id,
      );
      const alreadyClosed = await p.cMSClosedInvoice.findMany({
        where: { originalInvoiceId: { in: originalIds } },
        select: { originalInvoiceId: true },
      });
      const alreadyClosedSet = new Set(
        alreadyClosed.map((r: any) => r.originalInvoiceId),
      );
      const toInsert = closedInvoices.filter(
        (invoice: any) =>
          !alreadyClosedSet.has(invoice.originalInvoiceId ?? invoice.id),
      );
      if (toInsert.length > 0) {
        await p.cMSClosedInvoice.createMany({
          data: toInsert.map((invoice: any) => ({
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
      }
      // Invoices stay in CMSInvoice so the approved week remains printable.
      // They will be cleaned up when a new draft week is started.
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
