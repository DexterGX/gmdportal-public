import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";
import { calcCommission, toMoney } from "@/lib/salesCommission";

function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = String(value).trim();
  if (!text) return null;

  const cleaned = text
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/\((.+)\)/, "-$1")
    .replace(/[^0-9.-]/g, "");

  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInvoiceNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 1e-9) return String(rounded);
    return String(value);
  }

  const text = String(value).trim();
  if (!text) return "";
  if (/^-?\d+\.0+$/.test(text)) return text.split(".")[0];
  return text;
}

function parseCommissionRate(value: unknown): number | null {
  const parsed = parseDecimal(value);
  if (parsed === null) return null;
  if (parsed > 0 && parsed < 1) return Number((parsed * 100).toFixed(4));
  return parsed;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function asDate(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function customerKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function invoiceCustomerKey(invoiceNumber: string, customerName: unknown) {
  return `${invoiceNumber.trim()}__${customerKey(customerName)}`;
}

function uniqueInvoiceNumber(
  baseInvoiceNumber: string,
  usedInvoiceNumbers: Set<string>,
) {
  const base = baseInvoiceNumber.trim();
  if (!base) return "";
  if (!usedInvoiceNumbers.has(base)) {
    usedInvoiceNumbers.add(base);
    return base;
  }

  let seq = 2;
  let candidate = `${base}-D${seq}`;
  while (usedInvoiceNumbers.has(candidate)) {
    seq += 1;
    candidate = `${base}-D${seq}`;
  }
  usedInvoiceNumbers.add(candidate);
  return candidate;
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
    const periodId = String(body?.periodId || "").trim();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const preserveManualOverrides = body?.preserveManualOverrides !== false;

    if (!periodId) {
      return NextResponse.json(
        { error: "periodId is required" },
        { status: 400 },
      );
    }

    const settings =
      (await prisma.salesCommissionSettings.findFirst()) ||
      (await prisma.salesCommissionSettings.create({ data: {} }));

    const rowsToProcess = rows
      .map((rawRow: unknown) =>
        rawRow && typeof rawRow === "object"
          ? (rawRow as Record<string, unknown>)
          : null,
      )
      .filter(
        (row: Record<string, unknown> | null): row is Record<string, unknown> =>
          Boolean(row),
      );

    const invoiceNumberSet = new Set<string>();
    const quickbooksTxnIdSet = new Set<string>();
    rowsToProcess.forEach((row: Record<string, unknown>) => {
      const invoiceNumber = parseInvoiceNumber(row.invoiceNumber);
      if (isNonEmptyString(invoiceNumber)) {
        invoiceNumberSet.add(invoiceNumber);
      }

      const quickbooksTxnId = String(row.quickbooksTxnId || "").trim();
      if (isNonEmptyString(quickbooksTxnId)) {
        quickbooksTxnIdSet.add(quickbooksTxnId);
      }
    });

    const invoiceNumbers = Array.from(invoiceNumberSet);
    const quickbooksTxnIds = Array.from(quickbooksTxnIdSet);

    const existingInvoices = await prisma.salesCommissionInvoice.findMany({
      where: {
        periodId,
        OR: [
          ...(invoiceNumbers.length
            ? [{ invoiceNumber: { in: invoiceNumbers } }]
            : []),
          ...(quickbooksTxnIds.length
            ? [{ quickbooksTxnId: { in: quickbooksTxnIds } }]
            : []),
        ],
      },
      select: {
        id: true,
        customerName: true,
        manualOverrideFields: true,
        quickbooksTxnId: true,
        invoiceNumber: true,
      },
    });

    const allPeriodInvoiceNumbers =
      await prisma.salesCommissionInvoice.findMany({
        where: {
          periodId,
          invoiceNumber: {
            not: null,
          },
        },
        select: {
          invoiceNumber: true,
        },
      });

    const usedInvoiceNumbers = new Set(
      allPeriodInvoiceNumbers
        .map((row) => String(row.invoiceNumber || "").trim())
        .filter(Boolean),
    );

    const existingByInvoiceCustomer = new Map(
      existingInvoices
        .filter((row) => row.invoiceNumber)
        .map((row) => [
          invoiceCustomerKey(String(row.invoiceNumber), row.customerName),
          row,
        ]),
    );
    const existingByTxnId = new Map(
      existingInvoices
        .filter((row) => row.quickbooksTxnId)
        .map((row) => [String(row.quickbooksTxnId), row]),
    );

    let created = 0;
    let updated = 0;
    let skippedDueToManualConflicts = 0;
    let quickbooksTxnIdConflictRows = 0;

    for (const row of rowsToProcess) {
      const actionType = String(row.actionType || "").toUpperCase();
      const duplicateTxnInImport = Boolean(row.duplicateTxnInImport);
      if (actionType === "DUPLICATE" && duplicateTxnInImport) {
        skippedDueToManualConflicts += 1;
        continue;
      }
      if (actionType === "CONFLICT") {
        skippedDueToManualConflicts += 1;
        continue;
      }

      const invoiceNumber = parseInvoiceNumber(row.invoiceNumber);
      const quickbooksTxnId = String(row.quickbooksTxnId || "").trim();
      const incomingCustomerName =
        String(row.customerName || "Unknown").trim() || "Unknown";

      if (!invoiceNumber && !quickbooksTxnId) {
        skippedDueToManualConflicts += 1;
        continue;
      }

      const invoiceAmountParsed = parseDecimal(row.invoiceAmount);
      const commissionRateParsed = parseCommissionRate(row.commissionRate);
      const thirdPartyAdjustmentParsed = parseDecimal(row.thirdPartyAdjustment);
      const refundAdjustmentParsed = parseDecimal(row.refundAdjustment);
      const firstPaymentParsed = parseDecimal(row.firstPayment);
      const secondPaymentParsed = parseDecimal(row.secondPayment);

      const invoiceAmount = invoiceAmountParsed ?? 0;
      const commissionRate = commissionRateParsed ?? 0;
      const thirdPartyAdjustment = thirdPartyAdjustmentParsed ?? 0;
      const refundAdjustment = refundAdjustmentParsed ?? 0;

      const calc = calcCommission({
        invoiceAmount,
        commissionRatePercent: commissionRate,
        thirdPartyAdjustment,
        refundAdjustment,
        firstCommissionPercent: Number(settings.firstCommissionPercent),
        secondCommissionPercent: Number(settings.secondCommissionPercent),
      });

      const existing =
        (quickbooksTxnId ? existingByTxnId.get(quickbooksTxnId) : null) ||
        (invoiceNumber
          ? existingByInvoiceCustomer.get(
              invoiceCustomerKey(invoiceNumber, incomingCustomerName),
            )
          : null) ||
        null;

      if (existing) {
        if (
          preserveManualOverrides &&
          (existing.manualOverrideFields || []).length > 0
        ) {
          skippedDueToManualConflicts += 1;
          continue;
        }

        const incomingQuickbooksTxnId = quickbooksTxnId;
        let nextQuickbooksTxnId: string | null | undefined = undefined;
        if (incomingQuickbooksTxnId) {
          const existingQuickbooksTxnId = String(
            existing.quickbooksTxnId || "",
          ).trim();
          if (!existingQuickbooksTxnId) {
            nextQuickbooksTxnId = incomingQuickbooksTxnId;
          } else if (existingQuickbooksTxnId !== incomingQuickbooksTxnId) {
            quickbooksTxnIdConflictRows += 1;
            nextQuickbooksTxnId = undefined;
          }
        }

        await prisma.salesCommissionInvoice.update({
          where: { id: existing.id },
          data: {
            customerName:
              incomingCustomerName || existing.customerName || "Unknown",
            invoiceDate: asDate(row.invoiceDate),
            salesRepId: row.mappedSalesRepId
              ? String(row.mappedSalesRepId)
              : null,
            salesRepDisplay: row.mappedSalesRepName
              ? String(row.mappedSalesRepName)
              : row.salesRepInitials
                ? String(row.salesRepInitials)
                : null,
            salesRepInitialsRaw: row.salesRepInitials
              ? String(row.salesRepInitials)
              : null,
            salesRepUnmatched: Boolean(row.unmatchedSalesRep),
            quickbooksTxnId: nextQuickbooksTxnId,
            commissionRate:
              commissionRateParsed !== null
                ? new Prisma.Decimal(commissionRate)
                : null,
            invoiceAmount: new Prisma.Decimal(toMoney(invoiceAmount)),
            thirdPartyAdjustment: new Prisma.Decimal(
              toMoney(thirdPartyAdjustment),
            ),
            refundAdjustment: new Prisma.Decimal(toMoney(refundAdjustment)),
            totalCommissionCalculated: new Prisma.Decimal(calc.totalCommission),
            firstCommissionCalculated: new Prisma.Decimal(calc.firstCommission),
            secondCommissionCalculated: new Prisma.Decimal(
              calc.secondCommission,
            ),
            adjustedSecondCommissionCalculated: new Prisma.Decimal(
              calc.adjustedSecondCommission,
            ),
            firstPaymentNowOverride:
              firstPaymentParsed !== null
                ? new Prisma.Decimal(toMoney(firstPaymentParsed))
                : undefined,
            secondPaymentNowOverride:
              secondPaymentParsed !== null
                ? new Prisma.Decimal(toMoney(secondPaymentParsed))
                : undefined,
            notesFreeText: String(row.notes || "").trim() || undefined,
            importFlags: {
              importSource: "manual_customer_report",
            },
            updatedByUserId: access.userId,
          },
        });

        updated += 1;
        continue;
      }

      const persistedInvoiceNumber = invoiceNumber
        ? uniqueInvoiceNumber(invoiceNumber, usedInvoiceNumbers)
        : "";

      await prisma.salesCommissionInvoice.create({
        data: {
          periodId,
          invoiceNumber: persistedInvoiceNumber || null,
          quickbooksTxnId: quickbooksTxnId || null,
          customerName: incomingCustomerName,
          invoiceDate: asDate(row.invoiceDate),
          salesRepId: row.mappedSalesRepId
            ? String(row.mappedSalesRepId)
            : null,
          salesRepDisplay: row.mappedSalesRepName
            ? String(row.mappedSalesRepName)
            : row.salesRepInitials
              ? String(row.salesRepInitials)
              : null,
          salesRepInitialsRaw: row.salesRepInitials
            ? String(row.salesRepInitials)
            : null,
          salesRepUnmatched: Boolean(row.unmatchedSalesRep),
          commissionRate:
            commissionRateParsed !== null
              ? new Prisma.Decimal(commissionRate)
              : null,
          invoiceAmount: new Prisma.Decimal(toMoney(invoiceAmount)),
          thirdPartyAdjustment: new Prisma.Decimal(
            toMoney(thirdPartyAdjustment),
          ),
          refundAdjustment: new Prisma.Decimal(toMoney(refundAdjustment)),
          totalCommissionCalculated: new Prisma.Decimal(calc.totalCommission),
          firstCommissionCalculated: new Prisma.Decimal(calc.firstCommission),
          secondCommissionCalculated: new Prisma.Decimal(calc.secondCommission),
          adjustedSecondCommissionCalculated: new Prisma.Decimal(
            calc.adjustedSecondCommission,
          ),
          firstPaymentNowOverride:
            firstPaymentParsed !== null
              ? new Prisma.Decimal(toMoney(firstPaymentParsed))
              : null,
          secondPaymentNowOverride:
            secondPaymentParsed !== null
              ? new Prisma.Decimal(toMoney(secondPaymentParsed))
              : null,
          notesFreeText: String(row.notes || "").trim() || null,
          notesOptionLabels:
            commissionRateParsed === null ? ["Manual review needed"] : [],
          status: commissionRateParsed === null ? "MANUAL_REVIEW" : "OPEN",
          importFlags: {
            importSource: "manual_customer_report",
            quickbooksTxnIdImported: Boolean(quickbooksTxnId),
            originalInvoiceNumber: invoiceNumber || null,
            duplicateInvoiceNumberResolved: Boolean(
              invoiceNumber &&
              persistedInvoiceNumber &&
              invoiceNumber !== persistedInvoiceNumber,
            ),
          },
          createdByUserId: access.userId,
          updatedByUserId: access.userId,
        },
      });

      created += 1;
    }

    await prisma.salesCommissionAuditLog.create({
      data: {
        entityType: "INVOICE",
        entityId: periodId,
        fieldName: "importCommit",
        oldValue: Prisma.JsonNull,
        newValue: {
          created,
          updated,
          skippedDueToManualConflicts,
          quickbooksTxnIdConflictRows,
          preserveManualOverrides,
        },
        changedByUserId: access.userId,
      },
    });

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skippedDueToManualConflicts,
      quickbooksTxnIdConflictRows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to commit import" },
      { status: 500 },
    );
  }
}
