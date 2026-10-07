/**
 * Server-only helpers shared by the slab import routes
 * (src/app/api/slabs/admin/import/* and .../export).
 */

import type { Slab } from "@prisma/client";
import { prisma } from "./prisma";
import { getProgramUserContext } from "./programPermissions";
import {
  computeImportDiff,
  normalizeImportRow,
  templateRowToImportRow,
  thicknessEnumToString,
  type ImportDiff,
} from "./slabsImport";
import {
  SLAB_FINISH_OPTIONS,
  SLAB_STATUS_OPTIONS,
  SLAB_THICKNESS_OPTIONS,
  computeRowIssues,
  countBlockingErrors,
  newRowId,
  type RowIssue,
  type SlabRowFlag,
  type SlabTemplateRow,
} from "./slabsTemplate";

export async function requireSlabAdmin() {
  // Admin or Program Admin of Slabs Price List
  const { user, appRole, isActive, isProgramAdmin } =
    await getProgramUserContext("slabs");
  if (!user || !isActive || !isProgramAdmin) return null;
  return { user, appRole };
}

type SlabWithBrand = Slab & { brand: { name: string } };

export function serializeExistingSlab(slab: SlabWithBrand) {
  const heightIn = parseFloat(slab.heightIn.toString());
  const widthIn = parseFloat(slab.widthIn.toString());
  return {
    id: slab.id,
    slabNumber: slab.slabNumber,
    brand: slab.brand.name,
    series: slab.series,
    code: slab.providerCode,
    color: slab.color,
    finish: slab.finish,
    heightIn,
    widthIn,
    thickness: thicknessEnumToString(slab.thickness),
    squareFeet: Math.round(((heightIn * widthIn) / 144) * 10) / 10,
    listedPrice: parseFloat(slab.providerPrice.toString()),
    finalPrice: parseFloat(slab.finalPrice.toString()),
    status: slab.status,
  };
}

const FLAG_VALUES: SlabRowFlag[] = ["price-unverified", "low-confidence", "finish-unrecognized"];

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s.slice(0, 200) : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Never trust the browser's row objects - coerce every field to its expected type. */
export function sanitizeTemplateRows(raw: unknown): SlabTemplateRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5000).map((r: any) => {
    const finish = str(r?.finish)?.toUpperCase() || "";
    const thickness = str(r?.thickness) || "";
    const status = str(r?.status)?.toUpperCase() || "";
    return {
      id: str(r?.id) || newRowId(),
      series: str(r?.series),
      code: str(r?.code),
      color: str(r?.color) || "",
      finish: SLAB_FINISH_OPTIONS.includes(finish) ? finish : "OTHER",
      heightIn: num(r?.heightIn),
      widthIn: num(r?.widthIn),
      thickness: SLAB_THICKNESS_OPTIONS.includes(thickness) ? thickness : "",
      sfPrice: num(r?.sfPrice),
      slabPrice: num(r?.slabPrice),
      status: SLAB_STATUS_OPTIONS.includes(status) ? status : "AVAILABLE",
      source: str(r?.source),
      sourceFinish: str(r?.sourceFinish),
      sourceThickness: str(r?.sourceThickness),
      flags: Array.isArray(r?.flags) ? r.flags.filter((f: any) => FLAG_VALUES.includes(f)) : [],
      note: str(r?.note),
    };
  });
}

export type RowsDiffResult =
  | { ok: false; status: number; error: string; issues?: Record<string, RowIssue[]> }
  | {
      ok: true;
      brand: NonNullable<Awaited<ReturnType<typeof prisma.slabBrandConfig.findUnique>>>;
      diff: ImportDiff;
      existingSlabs: SlabWithBrand[];
      alreadyUnavailableCount: number;
    };

/**
 * Validates reviewed rows and diffs them against the brand's current slabs.
 * Used by BOTH preview and apply, so apply never trusts a diff the browser
 * computed or edited.
 */
export async function computeRowsDiff(brandId: string, rows: SlabTemplateRow[]): Promise<RowsDiffResult> {
  const brand = await prisma.slabBrandConfig.findUnique({ where: { id: brandId } });
  if (!brand) return { ok: false, status: 400, error: "Brand not found" };
  if (rows.length === 0) return { ok: false, status: 400, error: "There are no rows to import" };

  const issues = computeRowIssues(rows);
  const blocking = countBlockingErrors(issues);
  if (blocking > 0) {
    return {
      ok: false,
      status: 422,
      error: `${blocking} row${blocking === 1 ? " has" : "s have"} errors - fix them before continuing`,
      issues,
    };
  }

  const normalized = rows.map((row) =>
    normalizeImportRow(templateRowToImportRow(row, brand.name), brand, brand.name),
  );

  const existingSlabs = (await prisma.slab.findMany({
    where: { brandId: brand.id },
    include: { brand: { select: { name: true } } },
  })) as SlabWithBrand[];

  const fullDiff = computeImportDiff(normalized, existingSlabs, brand.name);
  // Slabs already UNAVAILABLE would just be re-marked UNAVAILABLE - leave
  // them out of the list so the Discontinued tab only shows real changes.
  const discontinued = fullDiff.discontinuedSlabs.filter((s) => s.status !== "UNAVAILABLE");

  return {
    ok: true,
    brand,
    diff: { ...fullDiff, discontinuedSlabs: discontinued },
    existingSlabs,
    alreadyUnavailableCount: fullDiff.discontinuedSlabs.length - discontinued.length,
  };
}
