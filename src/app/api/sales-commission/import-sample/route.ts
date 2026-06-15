import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";

const sampleRows = [
  {
    "Sales Rep": "EM",
    "Invoice Date": "06/05/2026",
    "Invoice Number": "130014",
    "Customer Name": "George and Leona Gati",
    "Commission Rate": 7.5,
    "Invoice Amount": 7130.45,
    "First Payment": 320.87,
    "Third Party": 0,
    Refund: 0,
    "Second Payment": 213.91,
    Notes: "Imported sample row",
  },
  {
    "Sales Rep": "ST",
    "Invoice Date": "06/09/2026",
    "Invoice Number": "130045",
    "Customer Name": "Sample Customer",
    "Commission Rate": 6.25,
    "Invoice Amount": 5120,
    "First Payment": 191.99,
    "Third Party": 50,
    Refund: 0,
    "Second Payment": 127.99,
    Notes: "Amount fields are numeric values",
  },
];

function toCsv(rows: Array<Record<string, unknown>>) {
  const headers = Object.keys(rows[0] || {});
  const escape = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
  };

  const lines = [headers.map(escape).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escape(row[key])).join(","));
  });
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const access = await requireSalesCommissionAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const format = (
    request.nextUrl.searchParams.get("format") || "xlsx"
  ).toLowerCase();
  if (format === "csv") {
    const csv = toCsv(sampleRows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=Sales-Commission-Import-Sample.csv",
      },
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, "ImportSample");
  const content = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;

  return new NextResponse(new Uint8Array(content), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        "attachment; filename=Sales-Commission-Import-Sample.xlsx",
    },
  });
}
