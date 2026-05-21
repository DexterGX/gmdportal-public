import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Decimal } from "@prisma/client/runtime/library";
import { calculateSinkFinalPrice } from "./sinksPricing";

export type SinkImportRow = {
  Brand: string;
  Series?: string;
  Model: string;
  Description?: string;
  Dimensions: string;
  Price: string | number;
  Status?: string;
};

export type NormalizedSinkImportRow = {
  brandName: string;
  series?: string | null;
  model: string;
  description?: string | null;
  dimensions: string;
  listedPrice: number;
  status?: "AVAILABLE" | "DISCONTINUED";
  key: string;
};

export function buildSinkImportKey(
  brandName: string,
  model: string,
  dimensions: string,
  description?: string | null,
): string {
  return `${brandName.trim().toLowerCase()}|${model.trim().toLowerCase()}|${dimensions.trim().toLowerCase()}|${String(description ?? "").trim().toLowerCase()}`;
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

    const hasStatus = row.Status !== undefined;
    const statusRaw = hasStatus
      ? String(row.Status ?? "")
          .trim()
          .toUpperCase()
      : "";
    const status = hasStatus
      ? statusRaw === "DISCONTINUED"
        ? "DISCONTINUED"
        : "AVAILABLE"
      : undefined;

    const hasSeries = row.Series !== undefined;
    const hasDescription = row.Description !== undefined;

    normalized.push({
      brandName: selectedBrandName,
      series: hasSeries ? (String(row.Series ?? "").trim() || null) : undefined,
      model,
      description: hasDescription
        ? (String(row.Description ?? "").trim() || null)
        : undefined,
      dimensions,
      listedPrice,
      status,
      key: buildSinkImportKey(
        selectedBrandName,
        model,
        dimensions,
        hasDescription ? String(row.Description ?? "") : "",
      ),
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
