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

// GET /api/sales-commission/invoices?weekId=...
export async function GET(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekId = searchParams.get("weekId");
  const salesRep = searchParams.get("salesRep") || undefined;
  const customer = searchParams.get("customer") || undefined;
  const invoiceNumber = searchParams.get("invoiceNumber") || undefined;

  const invoices = await p.cMSInvoice.findMany({
    where: {
      ...(weekId ? { weekId } : {}),
      ...(salesRep
        ? { salesRep: { contains: salesRep, mode: "insensitive" } }
        : {}),
      ...(customer
        ? { customer: { contains: customer, mode: "insensitive" } }
        : {}),
      ...(invoiceNumber
        ? { invoiceNumber: { contains: invoiceNumber, mode: "insensitive" } }
        : {}),
    },
    orderBy: [
      { salesRep: "asc" },
      { invoiceNumber: "asc" },
      { sortOrder: "asc" },
    ],
  });

  return NextResponse.json(invoices);
}

// POST /api/sales-commission/invoices
export async function POST(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const weekId = body.weekId as string;
  const replace = Boolean(body.replace);
  const rows = Array.isArray(body.rows) ? body.rows : [body];

  if (!weekId) {
    return NextResponse.json({ error: "weekId is required" }, { status: 400 });
  }

  const settings = await p.cMSSettings.findFirst();
  const firstPercent = settings?.firstPaymentPercent ?? 60;

  if (replace) {
    await p.cMSInvoice.deleteMany({ where: { weekId } });
  }

  const created = [];
  for (const row of rows) {
    const amount = Number(row.amount);
    const rate = Number(row.commissionRate);
    const baseCommission = parseFloat(((amount * rate) / 100).toFixed(2));
    const thirdPartyAmountValue =
      row.thirdPartyAmount != null && row.thirdPartyAmount !== ""
        ? Number(row.thirdPartyAmount)
        : null;
    const refundAmountValue =
      row.refundAmount != null && row.refundAmount !== ""
        ? Number(row.refundAmount)
        : null;
    const adjustedAmount =
      amount -
      Number(thirdPartyAmountValue ?? 0) -
      Number(refundAmountValue ?? 0);
    const calculatedCommission = parseFloat(
      ((adjustedAmount * rate) / 100).toFixed(2),
    );
    const firstPaymentAmount = parseFloat(
      ((baseCommission * firstPercent) / 100).toFixed(2),
    );
    const secondPaymentAmount = parseFloat(
      (calculatedCommission - firstPaymentAmount).toFixed(2),
    );

    const invoice = await p.cMSInvoice.create({
      data: {
        weekId,
        salesRep: row.salesRep,
        invoiceDate: new Date(row.invoiceDate),
        invoiceNumber: String(row.invoiceNumber),
        customer: row.customer,
        commissionRate: rate,
        amount,
        calculatedCommission,
        firstPaymentAmount,
        secondPaymentAmount,
        payFirst: Boolean(row.payFirst),
        paySecond: Boolean(row.paySecond),
        firstPaid: Boolean(row.firstPaid),
        firstPaidDate: row.firstPaidDate ? new Date(row.firstPaidDate) : null,
        secondPaid: Boolean(row.secondPaid),
        secondPaidDate: row.secondPaidDate
          ? new Date(row.secondPaidDate)
          : null,
        thirdPartyAmount: thirdPartyAmountValue,
        refundAmount: refundAmountValue,
        notes: row.notes || null,
        isNew: row.isNew ?? true,
        status: deriveInvoiceStatus(row),
        originalInvoiceId: row.originalInvoiceId || null,
        sortOrder: Number(row.sortOrder ?? 0),
      },
    });

    created.push(invoice);
  }

  return NextResponse.json({ created }, { status: 201 });
}

// PATCH /api/sales-commission/invoices/:id
export async function PATCH(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id)
    return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await p.cMSInvoice.findUnique({ where: { id: body.id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await p.cMSInvoice.update({
    where: { id: body.id },
    data: {
      salesRep: body.salesRep ?? existing.salesRep,
      invoiceDate: body.invoiceDate
        ? new Date(body.invoiceDate)
        : existing.invoiceDate,
      invoiceNumber: body.invoiceNumber ?? existing.invoiceNumber,
      customer: body.customer ?? existing.customer,
      commissionRate:
        body.commissionRate != null
          ? Number(body.commissionRate)
          : existing.commissionRate,
      amount: body.amount != null ? Number(body.amount) : existing.amount,
      calculatedCommission:
        body.calculatedCommission != null
          ? Number(body.calculatedCommission)
          : existing.calculatedCommission,
      firstPaymentAmount:
        body.firstPaymentAmount != null
          ? Number(body.firstPaymentAmount)
          : existing.firstPaymentAmount,
      secondPaymentAmount:
        body.secondPaymentAmount != null
          ? Number(body.secondPaymentAmount)
          : existing.secondPaymentAmount,
      payFirst: body.payFirst ?? existing.payFirst,
      paySecond: body.paySecond ?? existing.paySecond,
      firstPaid: body.firstPaid ?? existing.firstPaid,
      firstPaidDate:
        body.firstPaidDate !== undefined
          ? body.firstPaidDate
            ? new Date(body.firstPaidDate)
            : null
          : existing.firstPaidDate,
      secondPaid: body.secondPaid ?? existing.secondPaid,
      secondPaidDate:
        body.secondPaidDate !== undefined
          ? body.secondPaidDate
            ? new Date(body.secondPaidDate)
            : null
          : existing.secondPaidDate,
      thirdPartyAmount:
        body.thirdPartyAmount !== undefined
          ? body.thirdPartyAmount === null || body.thirdPartyAmount === ""
            ? null
            : Number(body.thirdPartyAmount)
          : existing.thirdPartyAmount,
      refundAmount:
        body.refundAmount !== undefined
          ? body.refundAmount === null || body.refundAmount === ""
            ? null
            : Number(body.refundAmount)
          : existing.refundAmount,
      notes: body.notes ?? existing.notes,
      isNew: body.isNew ?? existing.isNew,
      status: body.status ?? deriveInvoiceStatus({ ...existing, ...body }),
      originalInvoiceId: body.originalInvoiceId ?? existing.originalInvoiceId,
      sortOrder:
        body.sortOrder != null ? Number(body.sortOrder) : existing.sortOrder,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/sales-commission/invoices/:id
export async function DELETE(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id is required" }, { status: 400 });

  await p.cMSInvoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
