import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(value: Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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

    const periodId = request.nextUrl.searchParams.get("periodId")?.trim() || "";
    const includeClosed =
      request.nextUrl.searchParams.get("includeClosed") === "1";
    const client = request.nextUrl.searchParams.get("client")?.trim() || "";
    const invoice = request.nextUrl.searchParams.get("invoice")?.trim() || "";
    const salesRepId =
      request.nextUrl.searchParams.get("salesRepId")?.trim() || "";
    const checkDate = asDate(
      request.nextUrl.searchParams.get("checkDate")?.trim() || null,
    );

    const where: Prisma.SalesCommissionInvoiceWhereInput = {
      ...(periodId ? { periodId } : {}),
      ...(includeClosed ? {} : { status: { not: "CLOSED" } }),
      ...(client
        ? { customerName: { contains: client, mode: "insensitive" } }
        : {}),
      ...(invoice
        ? { invoiceNumber: { contains: invoice, mode: "insensitive" } }
        : {}),
      ...(salesRepId ? { salesRepId } : {}),
      ...(checkDate ? { period: { checkDate } } : {}),
    };

    const rows = await prisma.salesCommissionInvoice.findMany({
      where,
      include: {
        period: true,
      },
      orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    });

    const exportRows = rows.map((row) => ({
      Salesperson: row.salesRepDisplay || row.salesRepInitialsRaw || "",
      "Invoice Date": isoDate(row.invoiceDate),
      "Invoice Number": row.invoiceNumber || "",
      "Customer Name": row.customerName || "",
      "Commission Rate": row.commissionRate ? Number(row.commissionRate) : "",
      "Invoice Amount": Number(row.invoiceAmount),
      "Total Commission": Number(
        row.totalCommissionOverride ?? row.totalCommissionCalculated,
      ),
      "First Commission": Number(
        row.firstCommissionOverride ?? row.firstCommissionCalculated,
      ),
      "First Payment": Number(
        row.firstPaymentNowOverride ?? row.firstPaymentNowCalculated,
      ),
      "Third Party": Number(row.thirdPartyAdjustment),
      Refund: Number(row.refundAdjustment),
      "Second Commission": Number(
        row.secondCommissionOverride ?? row.secondCommissionCalculated,
      ),
      "Second Payment": Number(
        row.secondPaymentNowOverride ?? row.secondPaymentNowCalculated,
      ),
      Notes:
        `${(row.notesOptionLabels || []).join(" | ")} ${row.notesFreeText || ""}`.trim(),
      Status: row.status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, "OpenInvoices");

    const content = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;
    const today = isoDate(new Date());
    const fileName = `Sales-Commission-Open-Invoices-${today}.xlsx`;

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to export data" },
      { status: 500 },
    );
  }
}
