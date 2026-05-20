import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const prismaAny = prisma as any;

    await prismaAny.sinkBrand.update({
      where: { id },
      data: {
        name: String(body?.name ?? "").trim(),
        logoUrl: body?.logoUrl ? String(body.logoUrl) : null,
        factor: new Decimal(Number(body?.factor ?? 1)),
        taxFactor: new Decimal(Number(body?.taxFactor ?? 1)),
        freight: new Decimal(Number(body?.freight ?? 0)),
        discount: new Decimal(Number(body?.discount ?? 0)),
        contactName: body?.contactName ? String(body.contactName) : null,
        contactCell: body?.contactCell ? String(body.contactCell) : null,
        contactPhone: body?.contactPhone ? String(body.contactPhone) : null,
        contactEmail: body?.contactEmail ? String(body.contactEmail) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update sink brand" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const prismaAny = prisma as any;

    const brand = await prismaAny.sinkBrand.findUnique({
      where: { id },
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

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    await prismaAny.$transaction(async (tx: any) => {
      await tx.sink.deleteMany({ where: { brandId: id } });
      await tx.sinkBrand.delete({ where: { id } });
    });

    const storagePaths = [
      extractStoragePathFromUrl(brand.logoUrl ? String(brand.logoUrl) : null),
      ...brand.sinks
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

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete sink brand" },
      { status: 500 },
    );
  }
}
