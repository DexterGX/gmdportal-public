import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Decimal } from "@prisma/client/runtime/library";
import { calculateSinkFinalPrice } from "./sinksPricing";

export type SinkImportRow = {
  Brand: string;
  Model: string;
  Description?: string;
  Dimensions: string;
  Price: string | number;
  Status?: string;
};

export type NormalizedSinkImportRow = {
  brandName: string;
  model: string;
  description: string | null;
  dimensions: string;
  listedPrice: number;
  status: "AVAILABLE" | "DISCONTINUED";
  key: string;
};

export function buildSinkImportKey(
  brandName: string,
  model: string,
  dimensions: string,
): string {
  return `${brandName.trim().toLowerCase()}|${model.trim().toLowerCase()}|${dimensions.trim().toLowerCase()}`;
}

export async function parseSinkImportFile(
  file: File,
): Promise<SinkImportRow[]> {
  const fileName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  if (fileName.endsWith(".csv")) {
    const text = new TextDecoder().decode(uint8Array);
    const parsed = Papa.parse<SinkImportRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return parsed.data;
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = XLSX.read(uint8Array, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<SinkImportRow>(sheet);
  }

  throw new Error("Unsupported file format. Use CSV or XLSX.");
}

export function normalizeSinkImportRows(
  rows: SinkImportRow[],
  selectedBrandName: string,
): NormalizedSinkImportRow[] {
  const normalized: NormalizedSinkImportRow[] = [];

  for (const row of rows) {
    const model = String(row.Model ?? "").trim();
    const dimensions = String(row.Dimensions ?? "").trim();
    const listedPrice = Number(
      String(row.Price ?? "").replace(/[^0-9.-]/g, ""),
    );

    if (!model || !dimensions || !Number.isFinite(listedPrice)) {
      continue;
    }

    const statusRaw = String(row.Status ?? "AVAILABLE")
      .trim()
      .toUpperCase();
    const status = statusRaw === "DISCONTINUED" ? "DISCONTINUED" : "AVAILABLE";

    normalized.push({
      brandName: selectedBrandName,
      model,
      description: row.Description ? String(row.Description).trim() : null,
      dimensions,
      listedPrice,
      status,
      key: buildSinkImportKey(selectedBrandName, model, dimensions),
    });
  }

  return normalized;
}

export function computeSinkFinalPriceForImport(input: {
  listedPrice: number;
  factor: unknown;
  taxFactor: unknown;
  freight: unknown;
  discount: unknown;
}): number {
  const finalDecimal = calculateSinkFinalPrice({
    listedPrice: new Decimal(input.listedPrice),
    factor: input.factor as Decimal,
    taxFactor: input.taxFactor as Decimal,
    freight: input.freight as Decimal,
    discount: input.discount as Decimal,
  });

  return Number(finalDecimal.toString());
}
