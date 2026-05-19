import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

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
    const brands = Array.isArray(body?.brands) ? body.brands : [];

    if (brands.length === 0) {
      return NextResponse.json(
        { error: "No changes to save" },
        { status: 400 },
      );
    }

    const prismaAny = prisma as any;

    for (const row of brands) {
      const rowId = String(row?.id ?? "");
      const isNew = rowId.startsWith("new-") || Boolean(row?._isNew);
      const isDeleted = Boolean(row?._deleted);

      if (isDeleted && !isNew) {
        const sinkCount = await prismaAny.sink.count({
          where: { brandId: rowId },
        });
        if (sinkCount > 0) {
          return NextResponse.json(
            {
              error: `Cannot delete brand ${row.name}. Delete or reassign sinks first.`,
            },
            { status: 400 },
          );
        }

        await prismaAny.sinkBrand.delete({ where: { id: rowId } });
        continue;
      }

      if (isDeleted && isNew) {
        continue;
      }

      const data = {
        name: String(row?.name ?? "").trim(),
        logoUrl: row?.logoUrl ? String(row.logoUrl).trim() : null,
        factor: new Decimal(Number(row?.factor ?? 1)),
        taxFactor: new Decimal(Number(row?.taxFactor ?? 1)),
        freight: new Decimal(Number(row?.freight ?? 0)),
        discount: new Decimal(Number(row?.discount ?? 0)),
        contactName: row?.contactName ? String(row.contactName) : null,
        contactCell: row?.contactCell ? String(row.contactCell) : null,
        contactPhone: row?.contactPhone ? String(row.contactPhone) : null,
        contactEmail: row?.contactEmail ? String(row.contactEmail) : null,
      };

      if (!data.name) {
        return NextResponse.json(
          { error: "Brand name is required" },
          { status: 400 },
        );
      }

      if (isNew) {
        await prismaAny.sinkBrand.create({ data });
      } else {
        await prismaAny.sinkBrand.update({
          where: { id: rowId },
          data,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save sink brands" },
      { status: 500 },
    );
  }
}
