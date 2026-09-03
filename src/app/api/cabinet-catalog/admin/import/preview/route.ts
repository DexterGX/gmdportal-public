import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import {
  readWorkbookGrids,
  applyParsePlan,
  computeImportDiff,
  type CabinetImportParsePlan,
  type ExistingCatalogItem,
} from "@/lib/cabinetCatalogImport";
import { inferCabinetImportParsePlan } from "@/lib/cabinetCatalogImportAi";

const prismaAny = prisma as any;

async function requireAdmin() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

/**
 * POST /api/cabinet-catalog/admin/import/preview
 *
 * Upload a vendor price list, get back an AI-inferred parse plan plus the
 * resulting diff against the existing catalog for that vendor. Nothing is
 * written to the database - see .../import/apply for that.
 *
 * Accepts (multipart form data):
 *  - file: the vendor's xlsx/xls/csv price list
 *  - vendorId: an existing CabinetVendor id, OR
 *  - newVendorName: a name for a vendor that doesn't exist yet
 *  - parsePlan (optional): a JSON-encoded CabinetImportParsePlan to re-apply
 *    without calling the AI again (e.g. after an admin hand-edits a plan)
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const vendorId = (formData.get("vendorId") as string | null) || null;
    const newVendorName = (formData.get("newVendorName") as string | null) || null;
    const parsePlanRaw = formData.get("parsePlan") as string | null;
    const pricingModeRaw = (formData.get("pricingMode") as string | null) || "net";
    const pricingMode: "retail" | "net" = pricingModeRaw === "retail" ? "retail" : "net";
    const discountRaw = formData.get("discount") as string | null;
    const discount = discountRaw ? Number(discountRaw) || 0 : 0;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!vendorId && !newVendorName?.trim()) {
      return NextResponse.json(
        { error: "Select a vendor or provide a name for a new one" },
        { status: 400 },
      );
    }

    let vendorName: string;
    if (vendorId) {
      const vendor = await prismaAny.cabinetVendor.findUnique({ where: { id: vendorId } });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 400 });
      }
      vendorName = vendor.name;
    } else {
      vendorName = newVendorName!.trim();
    }

    const buffer = await file.arrayBuffer();
    let sheets;
    try {
      sheets = readWorkbookGrids(buffer, file.name);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Failed to read file" }, { status: 400 });
    }
    if (sheets.length === 0 || sheets.every((s) => s.grid.length === 0)) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    let parsePlan: CabinetImportParsePlan;
    if (parsePlanRaw) {
      try {
        parsePlan = JSON.parse(parsePlanRaw);
      } catch {
        return NextResponse.json({ error: "Invalid parsePlan JSON" }, { status: 400 });
      }
    } else {
      try {
        parsePlan = await inferCabinetImportParsePlan({ sheets, vendorName });
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || "AI parsing failed" },
          { status: 502 },
        );
      }
    }

    const sheet = sheets.find((s) => s.sheetName === parsePlan.sheetName);
    if (!sheet) {
      return NextResponse.json(
        { error: `Parse plan references unknown sheet "${parsePlan.sheetName}"` },
        { status: 400 },
      );
    }

    const { items, warnings } = applyParsePlan(sheet.grid, parsePlan, vendorName, {
      mode: pricingMode,
      discount,
    });
    if (items.length === 0) {
      return NextResponse.json(
        { error: "No item rows could be extracted with this parse plan", warnings },
        { status: 400 },
      );
    }

    const existingItemsRaw = vendorId
      ? await prismaAny.cabinetCatalogItem.findMany({
          where: { vendorId },
          include: { prices: { include: { tier: true } } },
        })
      : [];
    const existingItems: ExistingCatalogItem[] = existingItemsRaw.map((item: any) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      category: item.category,
      summaryBucket: item.summaryBucket,
      isActive: item.isActive,
      prices: item.prices.map((p: any) => ({
        tierId: p.tierId,
        price: p.price,
        tier: { id: p.tier.id, name: p.tier.name },
      })),
    }));

    const diff = computeImportDiff(items, existingItems, vendorName);

    return NextResponse.json({
      success: true,
      vendorName,
      parsePlan,
      sheetNames: sheets.map((s) => s.sheetName),
      diff,
      warnings,
      summary: {
        newCount: diff.newItems.length,
        changedCount: diff.changedItems.length,
        discontinuedCount: diff.discontinuedItems.length,
        totalProcessed: items.length,
      },
    });
  } catch (error: any) {
    console.error("Cabinet catalog import preview error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process file" },
      { status: 500 },
    );
  }
}
