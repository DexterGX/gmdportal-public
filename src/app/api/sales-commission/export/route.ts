import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const p = prisma as any;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekId = searchParams.get("weekId");
  const salesRep = searchParams.get("salesRep") || undefined;

  const invoices = await p.cMSInvoice.findMany({
    where: {
      ...(weekId ? { weekId } : {}),
      ...(salesRep ? { salesRep } : {}),
    },
    orderBy: [{ salesRep: "asc" }, { invoiceNumber: "asc" }],
  });

  const rows = invoices.map((row: any) => ({
    "Sales Rep": row.salesRep,
    Date: row.invoiceDate,
    "Invoice#": row.invoiceNumber,
    Customer: row.customer,
    "% Cms": row.commissionRate,
    Amount: row.amount,
    Commission: row.calculatedCommission,
    "1st Payment": row.firstPaymentAmount,
    "2nd Payment": row.secondPaymentAmount,
    Status: row.status,
    Notes: row.notes ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Commission");
  const body = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=commission-${weekId ?? "export"}.xlsx`,
    },
  });
}
