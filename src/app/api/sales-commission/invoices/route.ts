import { NextRequest, NextResponse } from "next/server";
import { Prisma, SalesCommissionInvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canManageFinalizedWeeks,
  requireSalesCommissionAccess,
} from "@/lib/salesCommissionAuth";
import { calcCommission, toMoney } from "@/lib/salesCommission";

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(value: Date | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDay();
  const deltaToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - deltaToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getSettings() {
  const existing = await prisma.salesCommissionSettings.findFirst();
  if (existing) {
    return existing;
  }
  return prisma.salesCommissionSettings.create({
    data: {},
  });
}

async function canEditInvoice(invoiceId: string, role: string) {
  const invoice = await prisma.salesCommissionInvoice.findUnique({
    where: { id: invoiceId },
    include: { period: true },
  });

  if (!invoice) {
    return { ok: false as const, error: "Invoice not found", status: 404 };
  }

  if (
    invoice.period?.status === "FINALIZED" &&
    !canManageFinalizedWeeks(role)
  ) {
    return {
      ok: false as const,
      error: "Weekly commission is finalized. Admin can reopen it first.",
      status: 403,
    };
  }

  return { ok: true as const, invoice };
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

    const periodId = request.nextUrl.searchParams.get("periodId")?.trim();
    const includeClosed =
      request.nextUrl.searchParams.get("includeClosed") === "1";
    const includeDraft =
      request.nextUrl.searchParams.get("includeDraft") === "1";
    const client = request.nextUrl.searchParams.get("client")?.trim();
    const invoiceNo = request.nextUrl.searchParams.get("invoice")?.trim();
    const salesRep = request.nextUrl.searchParams.get("salesRep")?.trim();
    const salesRepId = request.nextUrl.searchParams.get("salesRepId")?.trim();
    const checkDate = request.nextUrl.searchParams.get("checkDate")?.trim();
    const parsedCheckDate = asDate(checkDate);

    const periodWhere: Prisma.SalesCommissionPeriodWhereInput = {
      ...(!includeDraft && !periodId
        ? {
            status: {
              not: "DRAFT",
            },
          }
        : {}),
      ...(parsedCheckDate ? { checkDate: parsedCheckDate } : {}),
    };

    const where: Prisma.SalesCommissionInvoiceWhereInput = {
      periodId: { not: null },
      ...(periodId ? { periodId } : {}),
      ...(includeClosed ? {} : { status: { not: "CLOSED" } }),
      ...(client
        ? { customerName: { contains: client, mode: "insensitive" } }
        : {}),
      ...(invoiceNo
        ? { invoiceNumber: { contains: invoiceNo, mode: "insensitive" } }
        : {}),
      ...(salesRepId ? { salesRepId } : {}),
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
      period: { is: periodWhere },
    };

    const invoices = await prisma.salesCommissionInvoice.findMany({
      where,
      include: {
        salesRep: true,
        period: true,
      },
      orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ invoices });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load invoices" },
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
    const periodIdRaw = String(body?.periodId || "").trim();
    const periodId = periodIdRaw || null;
    const customerName = String(body?.customerName || "").trim();
    const invoiceNumber = String(body?.invoiceNumber || "").trim();
    const invoiceDate = asDate(body?.invoiceDate);
    const invoiceAmount = n(body?.invoiceAmount, 0);

    const fieldErrors: Record<string, string> = {};
    if (!invoiceNumber)
      fieldErrors.invoiceNumber = "Invoice number is required";
    if (!customerName) fieldErrors.customerName = "Customer name is required";
    if (!invoiceDate) fieldErrors.invoiceDate = "Invoice date is required";
    if (invoiceAmount <= 0)
      fieldErrors.invoiceAmount = "Invoice amount must be greater than 0";

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", fields: fieldErrors },
        { status: 400 },
      );
    }

    const settings = await getSettings();
    const calc = calcCommission({
      invoiceAmount: n(body?.invoiceAmount, 0),
      commissionRatePercent: n(body?.commissionRate, 0),
      thirdPartyAdjustment: n(body?.thirdPartyAdjustment, 0),
      refundAdjustment: n(body?.refundAdjustment, 0),
      firstCommissionPercent: Number(settings.firstCommissionPercent),
      secondCommissionPercent: Number(settings.secondCommissionPercent),
    });

    const salesRepId = body?.salesRepId ? String(body.salesRepId) : null;
    const commissionRateValue =
      body?.commissionRate === null || body?.commissionRate === undefined
        ? null
        : n(body.commissionRate, 0);
    const createStatus: SalesCommissionInvoiceStatus = body?.status
      ? (body.status as SalesCommissionInvoiceStatus)
      : !salesRepId || commissionRateValue === null
        ? "MANUAL_REVIEW"
        : "OPEN";

    const invoice = await prisma.salesCommissionInvoice.create({
      data: {
        periodId,
        quickbooksInvoiceId: body?.quickbooksInvoiceId
          ? String(body.quickbooksInvoiceId)
          : null,
        quickbooksTxnId: body?.quickbooksTxnId
          ? String(body.quickbooksTxnId).trim()
          : null,
        invoiceNumber,
        invoiceDate,
        customerName,
        salesRepId,
        salesRepDisplay: body?.salesRepDisplay
          ? String(body.salesRepDisplay)
          : null,
        salesRepInitialsRaw: body?.salesRepInitialsRaw
          ? String(body.salesRepInitialsRaw)
          : null,
        salesRepUnmatched: Boolean(body?.salesRepUnmatched),
        commissionRate:
          commissionRateValue === null
            ? null
            : new Prisma.Decimal(commissionRateValue),
        invoiceAmount: new Prisma.Decimal(toMoney(invoiceAmount)),
        quickbooksBalance: new Prisma.Decimal(
          toMoney(body?.quickbooksBalance || 0),
        ),
        thirdPartyAdjustment: new Prisma.Decimal(
          toMoney(body?.thirdPartyAdjustment || 0),
        ),
        refundAdjustment: new Prisma.Decimal(
          toMoney(body?.refundAdjustment || 0),
        ),
        totalCommissionCalculated: new Prisma.Decimal(calc.totalCommission),
        firstCommissionCalculated: new Prisma.Decimal(calc.firstCommission),
        secondCommissionCalculated: new Prisma.Decimal(calc.secondCommission),
        adjustedSecondCommissionCalculated: new Prisma.Decimal(
          calc.adjustedSecondCommission,
        ),
        firstPaymentNowCalculated: new Prisma.Decimal(
          toMoney(body?.firstPaymentNow ?? 0),
        ),
        secondPaymentNowCalculated: new Prisma.Decimal(
          toMoney(body?.secondPaymentNow ?? 0),
        ),
        notesOptionLabels: asStringArray(body?.notesOptionLabels),
        notesFreeText:
          typeof body?.notesFreeText === "string" && body.notesFreeText.trim()
            ? body.notesFreeText.trim()
            : null,
        status: createStatus,
        createdByUserId: access.userId,
        updatedByUserId: access.userId,
      },
    });

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "INVOICE",
        entityId: invoice.id,
        fieldName: "created",
        oldValue: Prisma.JsonNull,
        newValue: {
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          periodId: invoice.periodId,
          quickbooksTxnId: invoice.quickbooksTxnId,
        },
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({ invoice });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create invoice" },
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
    const invoiceId = String(body?.invoiceId || "").trim();
    const updates = body?.updates || {};

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 },
      );
    }

    const editable = await canEditInvoice(invoiceId, access.appRole);
    if (!editable.ok) {
      return NextResponse.json(
        { error: editable.error },
        { status: editable.status },
      );
    }

    const current = editable.invoice;
    const settings = await getSettings();

    const invoiceAmount =
      updates.invoiceAmount !== undefined
        ? n(updates.invoiceAmount, 0)
        : Number(current.invoiceAmount);
    const commissionRate =
      updates.commissionRate !== undefined
        ? n(updates.commissionRate, 0)
        : Number(current.commissionRate || 0);
    const thirdPartyAdjustment =
      updates.thirdPartyAdjustment !== undefined
        ? n(updates.thirdPartyAdjustment, 0)
        : Number(current.thirdPartyAdjustment);
    const refundAdjustment =
      updates.refundAdjustment !== undefined
        ? n(updates.refundAdjustment, 0)
        : Number(current.refundAdjustment);

    const calc = calcCommission({
      invoiceAmount,
      commissionRatePercent: commissionRate,
      thirdPartyAdjustment,
      refundAdjustment,
      firstCommissionPercent: Number(settings.firstCommissionPercent),
      secondCommissionPercent: Number(settings.secondCommissionPercent),
    });

    const manualOverrideFields = new Set(current.manualOverrideFields || []);

    const maybeSetOverride = (
      key: string,
      overrideKey: string,
      updateInput: Prisma.SalesCommissionInvoiceUpdateInput,
    ) => {
      if (updates[key] === undefined) return;
      (updateInput as any)[overrideKey] = new Prisma.Decimal(
        toMoney(updates[key]),
      );
      manualOverrideFields.add(overrideKey);
    };

    const updateData: Prisma.SalesCommissionInvoiceUncheckedUpdateInput = {
      updatedByUserId: access.userId,
      invoiceNumber:
        updates.invoiceNumber !== undefined
          ? String(updates.invoiceNumber || "").trim() || null
          : undefined,
      quickbooksTxnId:
        updates.quickbooksTxnId !== undefined
          ? String(updates.quickbooksTxnId || "").trim() || null
          : undefined,
      invoiceDate:
        updates.invoiceDate !== undefined
          ? asDate(updates.invoiceDate)
          : undefined,
      customerName:
        updates.customerName !== undefined
          ? String(updates.customerName || "").trim()
          : undefined,
      salesRepId:
        updates.salesRepId !== undefined
          ? String(updates.salesRepId || "").trim() || null
          : undefined,
      salesRepDisplay:
        updates.salesRepDisplay !== undefined
          ? String(updates.salesRepDisplay || "").trim() || null
          : undefined,
      salesRepInitialsRaw:
        updates.salesRepInitialsRaw !== undefined
          ? String(updates.salesRepInitialsRaw || "").trim() || null
          : undefined,
      salesRepUnmatched:
        updates.salesRepUnmatched !== undefined
          ? Boolean(updates.salesRepUnmatched)
          : undefined,
      commissionRate:
        updates.commissionRate !== undefined
          ? new Prisma.Decimal(commissionRate)
          : undefined,
      invoiceAmount:
        updates.invoiceAmount !== undefined
          ? new Prisma.Decimal(toMoney(invoiceAmount))
          : undefined,
      quickbooksBalance:
        updates.quickbooksBalance !== undefined
          ? new Prisma.Decimal(toMoney(updates.quickbooksBalance))
          : undefined,
      thirdPartyAdjustment:
        updates.thirdPartyAdjustment !== undefined
          ? new Prisma.Decimal(toMoney(thirdPartyAdjustment))
          : undefined,
      refundAdjustment:
        updates.refundAdjustment !== undefined
          ? new Prisma.Decimal(toMoney(refundAdjustment))
          : undefined,
      totalCommissionCalculated: new Prisma.Decimal(calc.totalCommission),
      firstCommissionCalculated: new Prisma.Decimal(calc.firstCommission),
      secondCommissionCalculated: new Prisma.Decimal(calc.secondCommission),
      adjustedSecondCommissionCalculated: new Prisma.Decimal(
        calc.adjustedSecondCommission,
      ),
      notesOptionLabels:
        updates.notesOptionLabels !== undefined
          ? asStringArray(updates.notesOptionLabels)
          : undefined,
      notesFreeText:
        updates.notesFreeText !== undefined
          ? String(updates.notesFreeText || "").trim() || null
          : undefined,
      status:
        updates.status !== undefined
          ? (String(updates.status) as SalesCommissionInvoiceStatus)
          : undefined,
      depositPaidDate:
        updates.depositPaidDate !== undefined
          ? asDate(updates.depositPaidDate)
          : undefined,
      fullyPaidDate:
        updates.fullyPaidDate !== undefined
          ? asDate(updates.fullyPaidDate)
          : undefined,
    };

    maybeSetOverride("totalCommission", "totalCommissionOverride", updateData);
    maybeSetOverride("firstCommission", "firstCommissionOverride", updateData);
    maybeSetOverride(
      "secondCommission",
      "secondCommissionOverride",
      updateData,
    );
    maybeSetOverride("firstPaymentNow", "firstPaymentNowOverride", updateData);
    maybeSetOverride(
      "secondPaymentNow",
      "secondPaymentNowOverride",
      updateData,
    );

    const firstNow =
      updates.firstPaymentNow !== undefined
        ? toMoney(updates.firstPaymentNow)
        : Number(
            current.firstPaymentNowOverride ??
              current.firstPaymentNowCalculated,
          );
    const secondNow =
      updates.secondPaymentNow !== undefined
        ? toMoney(updates.secondPaymentNow)
        : Number(
            current.secondPaymentNowOverride ??
              current.secondPaymentNowCalculated,
          );

    const expectedFirst = Number(calc.firstCommission);
    const expectedSecond = Number(calc.adjustedSecondCommission);

    const paymentFieldsUpdated =
      updates.firstPaymentNow !== undefined ||
      updates.secondPaymentNow !== undefined;

    if (paymentFieldsUpdated && updates.status === undefined) {
      // Entered payment amounts are treated as scheduled in the current week.
      // They become paid only when a subsequent weekly period is created.
      if (secondNow > 0 || firstNow > 0) {
        updateData.status = "OPEN";
        updateData.closedAt = undefined;
      } else {
        updateData.status = "OPEN";
        updateData.closedAt = null;
      }
    }

    if (paymentFieldsUpdated) {
      if (
        firstNow + 0.009 < expectedFirst &&
        secondNow + 0.009 < expectedSecond
      ) {
        manualOverrideFields.delete("firstPaymentNowOverride");
        manualOverrideFields.delete("secondPaymentNowOverride");
      }
    }

    updateData.manualOverrideFields = Array.from(manualOverrideFields);

    const updated = await prisma.salesCommissionInvoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    const auditableFields = [
      "commissionRate",
      "invoiceAmount",
      "quickbooksBalance",
      "firstPaymentNow",
      "secondPaymentNow",
      "refundAdjustment",
      "thirdPartyAdjustment",
      "notesOptionLabels",
      "notesFreeText",
      "status",
      "salesRepId",
      "salesRepDisplay",
      "quickbooksTxnId",
    ];

    for (const fieldName of auditableFields) {
      if (updates[fieldName] === undefined) {
        continue;
      }

      const before = (current as any)[fieldName];
      const after = (updated as any)[fieldName];

      await prisma.salesCommissionAuditLog.create({
        data: {
          entityType: "INVOICE",
          entityId: updated.id,
          fieldName,
          oldValue: before as any,
          newValue: after as any,
          changedByUserId: access.userId,
        },
      });
    }

    return NextResponse.json({ invoice: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update invoice" },
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

    if (!["admin", "finance"].includes(access.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoiceId = request.nextUrl.searchParams.get("invoiceId")?.trim();
    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 },
      );
    }

    const editable = await canEditInvoice(invoiceId, access.appRole);
    if (!editable.ok) {
      return NextResponse.json(
        { error: editable.error },
        { status: editable.status },
      );
    }

    await prisma.salesCommissionInvoice.delete({ where: { id: invoiceId } });

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "INVOICE",
        entityId: invoiceId,
        fieldName: "deleted",
        oldValue: { deleted: true },
        newValue: Prisma.JsonNull,
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete invoice" },
      { status: 500 },
    );
  }
}
