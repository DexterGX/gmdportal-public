import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";

export async function GET(request: NextRequest) {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const client = request.nextUrl.searchParams.get("client")?.trim();
    const invoice = request.nextUrl.searchParams.get("invoice")?.trim();
    const salesRep = request.nextUrl.searchParams.get("salesRep")?.trim();
    const checkDate = request.nextUrl.searchParams.get("checkDate")?.trim();
    const periodId = request.nextUrl.searchParams.get("periodId")?.trim();

    const where: Prisma.SalesCommissionInvoiceWhereInput = {
      status: "CLOSED",
      ...(periodId ? { periodId } : {}),
      ...(client
        ? { customerName: { contains: client, mode: "insensitive" } }
        : {}),
      ...(invoice
        ? { invoiceNumber: { contains: invoice, mode: "insensitive" } }
        : {}),
      ...(salesRep
        ? {
            OR: [
              { salesRepDisplay: { contains: salesRep, mode: "insensitive" } },
              {
                salesRepInitialsRaw: {
                  contains: salesRep,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
      ...(checkDate
        ? {
            period: {
              checkDate: new Date(checkDate),
            },
          }
        : {}),
    };

    const rows = await prisma.salesCommissionInvoice.findMany({
      where,
      include: {
        period: true,
        salesRep: true,
      },
      orderBy: [
        { fullyPaidDate: "desc" },
        { closedAt: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json({ rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load closed invoices" },
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

    if (access.appRole !== "admin") {
      return NextResponse.json(
        { error: "Only admin users can reopen closed invoices." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const invoiceId = String(body?.invoiceId || "").trim();
    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 },
      );
    }

    const current = await prisma.salesCommissionInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!current) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const updated = await prisma.salesCommissionInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "OPEN",
        closedAt: null,
        updatedByUserId: access.userId,
      },
    });

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "INVOICE",
        entityId: updated.id,
        fieldName: "status",
        oldValue: current.status,
        newValue: "OPEN",
        notes: "Closed invoice reopened by admin",
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({ row: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reopen invoice" },
      { status: 500 },
    );
  }
}
