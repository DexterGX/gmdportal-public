import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireSlabAdmin } from "@/lib/slabsImportServer";
import { thicknessEnumToString } from "@/lib/slabsImport";
import {
  SLAB_TEMPLATE_COL_WIDTHS,
  SLAB_THICKNESS_OPTIONS,
  rowsToTemplateAoa,
  templateFileName,
} from "@/lib/slabsTemplate";

/**
 * GET /api/slabs/admin/export?brandId=...
 *
 * Downloads a brand's CURRENT slabs as an .xlsx in the GMD import template,
 * so the list can be edited in Excel and re-imported. The stored provider
 * price is per slab, so it is exported as Slab_Price (SF_Price left blank).
 */
export async function GET(request: Request) {
  try {
    if (!(await requireSlabAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const brandId = new URL(request.url).searchParams.get("brandId") || "";
    if (!brandId) return NextResponse.json({ error: "Brand not selected" }, { status: 400 });

    const brand = await prisma.slabBrandConfig.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const slabs = await prisma.slab.findMany({
      where: { brandId },
      orderBy: [{ series: "asc" }, { color: "asc" }],
    });

    const rows = slabs
      .map((s) => ({
        series: s.series,
        code: s.providerCode || null,
        color: s.color,
        finish: s.finish as string,
        heightIn: parseFloat(s.heightIn.toString()),
        widthIn: parseFloat(s.widthIn.toString()),
        thickness: thicknessEnumToString(s.thickness),
        sfPrice: null,
        slabPrice: parseFloat(s.providerPrice.toString()),
        status: s.status as string,
      }))
      .sort(
        (a, b) =>
          (a.series || "").localeCompare(b.series || "") ||
          a.color.localeCompare(b.color) ||
          SLAB_THICKNESS_OPTIONS.indexOf(a.thickness) - SLAB_THICKNESS_OPTIONS.indexOf(b.thickness),
      );

    const sheet = XLSX.utils.aoa_to_sheet(rowsToTemplateAoa(rows, brand.name));
    sheet["!cols"] = SLAB_TEMPLATE_COL_WIDTHS.map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Price List");
    const buffer: Buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${templateFileName(brand.name, "price_list")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Slab price list export error:", error);
    return NextResponse.json({ error: error.message || "Failed to export" }, { status: 500 });
  }
}
