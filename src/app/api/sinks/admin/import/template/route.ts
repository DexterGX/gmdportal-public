import { NextResponse } from "next/server";

export async function GET() {
  const csv = [
    "Brand,Series,Model,Description,Dimensions,Price",
    "Franke,Workstation,FK-1200,Stainless undermount sink,31x18x10,425.00",
    "Franke,Farmhouse,FK-1201,Double bowl sink,33x20x10,510.00",
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=sinks_import_template.csv",
    },
  });
}
