import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import {
  normalizeSinkImportRows,
  parseSinkImportFile,
  computeSinkFinalPriceForImport,
  buildSinkImportKey,
} from "@/lib/sinksImport";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function sameMoney(left: number, right: number, toleranceCents = 0): boolean {
  const leftCents = Math.round(Number(left) * 100);
  const rightCents = Math.round(Number(right) * 100);
  return Math.abs(leftCents - rightCents) <= toleranceCents;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getProgramUserContext("sinks");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const brandId = String(formData.get("brandId") ?? "").trim();

    if (!(file instanceof File) || !brandId) {
      return NextResponse.json(
        { error: "Brand and file are required" },
        { status: 400 },
      );
    }

    const prismaAny = prisma as any;
    const brand = await prismaAny.sinkBrand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      return NextResponse.json(
        { error: "Selected brand not found" },
        { status: 400 },
      );
    }

    const rows = await parseSinkImportFile(file);
    const normalized = normalizeSinkImportRows(rows, brand.name);

    if (normalized.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in file" },
        { status: 400 },
      );
    }

    const existing = await prismaAny.sink.findMany({
      where: { brandId },
      include: { brand: { select: { name: true } } },
    });

    const existingByKey = new Map<string, any>();
    for (const sink of existing) {
      existingByKey.set(
        buildSinkImportKey(
          brand.name,
          sink.model,
          sink.dimensions,
          sink.description,
        ),
        sink,
      );
    }

    const seenKeys = new Set<string>();
    const newSinks: any[] = [];
    const updatedSinks: any[] = [];

    for (const row of normalized) {
      seenKeys.add(row.key);
      const match = existingByKey.get(row.key);

      const nextFinalPrice = computeSinkFinalPriceForImport({
        listedPrice: row.listedPrice,
        factor: brand.factor,
        taxFactor: brand.taxFactor,
        freight: brand.freight,
        discount: brand.discount,
      });

      if (!match) {
        newSinks.push({
          brandName: brand.name,
          series: row.series ?? null,
          model: row.model,
          description: row.description ?? null,
          dimensions: row.dimensions,
          listedPrice: row.listedPrice,
          finalPrice: nextFinalPrice,
          status: row.status ?? "AVAILABLE",
        });
        continue;
      }

      const effectiveSeries =
        row.series === undefined ? match.series : (row.series ?? null);
      const effectiveDescription =
        row.description === undefined
          ? match.description
          : (row.description ?? null);
      const effectiveStatus =
        row.status === undefined ? String(match.status) : row.status;

      const before = {
        series: match.series,
        listedPrice: Number(match.listedPrice),
        finalPrice: Number(match.finalPrice),
        status: String(match.status),
        description: match.description,
      };

      const after = {
        series: effectiveSeries,
        listedPrice: row.listedPrice,
        finalPrice: nextFinalPrice,
        status: effectiveStatus,
        description: effectiveDescription,
      };

      if (
        normalizeText(before.series) !== normalizeText(after.series) ||
        !sameMoney(before.listedPrice, after.listedPrice) ||
        !sameMoney(before.finalPrice, after.finalPrice, 1) ||
        normalizeText(before.status).toUpperCase() !==
          normalizeText(after.status).toUpperCase() ||
        normalizeText(before.description) !== normalizeText(after.description)
      ) {
        updatedSinks.push({
          id: match.id,
          model: row.model,
          dimensions: row.dimensions,
          before,
          after,
        });
      }
    }

    const discontinuedSinks = existing
      .filter(
        (sink: any) =>
          !seenKeys.has(
            buildSinkImportKey(
              brand.name,
              sink.model,
              sink.dimensions,
              sink.description,
            ),
          ),
      )
      .map((sink: any) => ({
        id: sink.id,
        series: sink.series,
        model: sink.model,
        description: sink.description ?? null,
        dimensions: sink.dimensions,
        listedPrice: Number(sink.listedPrice),
        finalPrice: Number(sink.finalPrice),
        status: String(sink.status),
      }));

    return NextResponse.json({
      diff: {
        newSinks,
        updatedSinks,
        discontinuedSinks,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to preview sink import" },
      { status: 500 },
    );
  }
}
