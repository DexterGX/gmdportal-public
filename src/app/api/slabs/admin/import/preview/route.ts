import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  type ImportRow,
  type NormalizedImportSlab,
  type ImportDiff,
  normalizeImportRow,
  computeImportDiff,
  generateSlabKey,
} from "@/lib/slabsImport";

/**
 * POST /api/slabs/admin/import/preview
 * Upload file and get preview of changes
 */
export async function POST(request: Request) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const selectedBrandId = formData.get("brandId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!selectedBrandId) {
      return NextResponse.json(
        { error: "Brand not selected" },
        { status: 400 }
      );
    }

    // Get selected brand config
    const brandConfig = await prisma.slabBrandConfig.findUnique({
      where: { id: selectedBrandId },
    });

    if (!brandConfig) {
      return NextResponse.json({ error: "Brand not found" }, { status: 400 });
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    let rows: any[] = [];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      // Parse CSV
      const text = new TextDecoder().decode(uint8Array);
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      });
      rows = parsed.data;
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      // Parse XLSX
      const workbook = XLSX.read(uint8Array, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet);
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Use CSV or XLSX." },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "File is empty or has no data rows" },
        { status: 400 }
      );
    }

    // Parse and normalize rows
    const importRows: ImportRow[] = [];

    for (const row of rows) {
      // Skip invalid rows
      if (!row.Color || !row.Finish || !row.Thickness) {
        continue;
      }

      const sfPriceVal = row.SF_Price ? parseFloat(row.SF_Price) : null;
      const slabPriceVal = row.Slab_Price ? parseFloat(row.Slab_Price) : null;

      // Skip if neither price is provided
      if (
        (sfPriceVal == null || sfPriceVal === 0) &&
        (slabPriceVal == null || slabPriceVal === 0)
      ) {
        continue;
      }

      const importRow: ImportRow = {
        brand: brandConfig.name, // Use selected brand name
        series: row.Series ? String(row.Series).trim() : null,
        code: row.Code ? String(row.Code).trim() : null,
        color: String(row.Color).trim(),
        finish: String(row.Finish).trim(),
        heightIn: parseFloat(row.H) || 0,
        widthIn: parseFloat(row.W) || 0,
        thickness: String(row.Thickness).trim(),
        sfPrice: sfPriceVal,
        slabPrice: slabPriceVal,
        status: row.Status ? String(row.Status).trim() : "AVAILABLE",
      };

      importRows.push(importRow);
    }

    if (importRows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in file" },
        { status: 400 }
      );
    }

    // Normalize import rows with computed prices
    const normalizedSlabs: NormalizedImportSlab[] = [];
    for (const row of importRows) {
      const normalized = normalizeImportRow(row, brandConfig, brandConfig.name);
      normalizedSlabs.push(normalized);
    }

    // Get existing slabs for this brand only
    const existingSlabs = await prisma.slab.findMany({
      where: {
        brandId: brandConfig.id,
      },
      include: {
        brand: {
          select: { name: true },
        },
      },
    });

    // Compute diff
    const diff = computeImportDiff(
      normalizedSlabs,
      existingSlabs as any,
      brandConfig.name // Pass selected brand name
    );

    // Return preview data
    return NextResponse.json({
      success: true,
      diff: {
        newSlabs: diff.newSlabs,
        changedSlabs: diff.changedSlabs.map((change) => ({
          existing: {
            id: change.existing.id,
            slabNumber: change.existing.slabNumber,
            brand: (change.existing as any).brand.name,
            series: change.existing.series,
            code: change.existing.providerCode,
            color: change.existing.color,
            finish: change.existing.finish,
            heightIn: parseFloat(change.existing.heightIn.toString()),
            widthIn: parseFloat(change.existing.widthIn.toString()),
            thickness: change.existing.thickness,
            squareFeet:
              (parseFloat(change.existing.heightIn.toString()) *
                parseFloat(change.existing.widthIn.toString())) /
              144,
            listedPrice: parseFloat(change.existing.providerPrice.toString()),
            finalPrice: parseFloat(change.existing.finalPrice.toString()),
            status: change.existing.status,
          },
          incoming: change.incoming,
          changes: change.changes,
        })),
        discontinuedSlabs: diff.discontinuedSlabs.map((slab) => ({
          id: slab.id,
          slabNumber: slab.slabNumber,
          brand: (slab as any).brand.name,
          series: slab.series,
          code: slab.providerCode,
          color: slab.color,
          finish: slab.finish,
          heightIn: parseFloat(slab.heightIn.toString()),
          widthIn: parseFloat(slab.widthIn.toString()),
          thickness: slab.thickness,
          squareFeet:
            (parseFloat(slab.heightIn.toString()) *
              parseFloat(slab.widthIn.toString())) /
            144,
          listedPrice: parseFloat(slab.providerPrice.toString()),
          finalPrice: parseFloat(slab.finalPrice.toString()),
          status: slab.status,
        })),
      },
      summary: {
        newCount: diff.newSlabs.length,
        changedCount: diff.changedSlabs.length,
        discontinuedCount: diff.discontinuedSlabs.length,
        totalProcessed: importRows.length,
      },
    });
  } catch (error: any) {
    console.error("Import preview error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process file" },
      { status: 500 }
    );
  }
}
