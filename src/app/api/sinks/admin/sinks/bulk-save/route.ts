import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { calculateSinkFinalPrice } from "@/lib/sinksPricing";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const sinks = Array.isArray(body?.sinks) ? body.sinks : [];

    if (sinks.length === 0) {
      return NextResponse.json({ error: "No sinks to save" }, { status: 400 });
    }

    const prismaAny = prisma as any;

    for (const row of sinks) {
      const rowId = String(row?.id ?? "");
      const isNew = rowId.startsWith("new-") || Boolean(row?._isNew);
      const isDeleted = Boolean(row?._deleted);

      if (isDeleted && !isNew) {
        await prismaAny.sink.delete({ where: { id: rowId } });
        continue;
      }

      if (isDeleted && isNew) {
        continue;
      }

      const brandId = String(row?.brandId ?? "").trim();
      const model = String(row?.model ?? "").trim();
      const dimensions = String(row?.dimensions ?? "").trim();
      const listedPrice = Number(row?.listedPrice ?? 0);
      const status = String(row?.status ?? "AVAILABLE")
        .trim()
        .toUpperCase();

      if (!brandId || !model || !dimensions || !Number.isFinite(listedPrice)) {
        return NextResponse.json(
          {
            error:
              "Brand, model, dimensions and numeric listed price are required",
          },
          { status: 400 },
        );
      }

      const brand = await prismaAny.sinkBrand.findUnique({
        where: { id: brandId },
      });
      if (!brand) {
        return NextResponse.json(
          { error: "Selected brand not found" },
          { status: 400 },
        );
      }

      const finalPrice = calculateSinkFinalPrice({
        listedPrice: new Decimal(listedPrice),
        factor: brand.factor,
        taxFactor: brand.taxFactor,
        freight: brand.freight,
        discount: brand.discount,
      });

      const data = {
        brandId,
        model,
        description: row?.description ? String(row.description) : null,
        dimensions,
        listedPrice: new Decimal(listedPrice),
        finalPrice,
        status: status === "DISCONTINUED" ? "DISCONTINUED" : "AVAILABLE",
        isPromotional: Boolean(row?.isPromotional),
        promotionalPrice:
          row?.isPromotional &&
          row?.promotionalPrice !== null &&
          row?.promotionalPrice !== undefined
            ? new Decimal(Number(row.promotionalPrice))
            : null,
        imageUrl: row?.imageUrl ? String(row.imageUrl) : null,
      };

      if (isNew) {
        await prismaAny.sink.create({ data });
      } else {
        await prismaAny.sink.update({
          where: { id: rowId },
          data,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save sinks" },
      { status: 500 },
    );
  }
}
