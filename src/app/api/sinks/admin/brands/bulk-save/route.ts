import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Decimal } from "@prisma/client/runtime/library";

const BUCKET_NAME = process.env.SUPABASE_SINKS_BUCKET || "sinks-assets";

function extractStoragePathFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const marker = `${BUCKET_NAME}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return url.slice(markerIndex + marker.length);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getProgramUserContext("sinks");
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
        const brandToDelete = await prismaAny.sinkBrand.findUnique({
          where: { id: rowId },
          select: {
            id: true,
            logoUrl: true,
            sinks: {
              select: {
                id: true,
                imageUrl: true,
              },
            },
          },
        });

        if (!brandToDelete) {
          continue;
        }

        await prismaAny.$transaction(async (tx: any) => {
          await tx.sink.deleteMany({ where: { brandId: rowId } });
          await tx.sinkBrand.delete({ where: { id: rowId } });
        });

        const storagePaths = [
          extractStoragePathFromUrl(
            brandToDelete.logoUrl ? String(brandToDelete.logoUrl) : null,
          ),
          ...brandToDelete.sinks
            .map((sink: any) =>
              extractStoragePathFromUrl(
                sink.imageUrl ? String(sink.imageUrl) : null,
              ),
            )
            .filter(Boolean),
        ].filter(Boolean) as string[];

        if (storagePaths.length > 0) {
          await supabaseAdmin.storage.from(BUCKET_NAME).remove(storagePaths);
        }

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
