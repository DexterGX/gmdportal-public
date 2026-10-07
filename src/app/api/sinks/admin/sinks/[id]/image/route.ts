import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET_NAME = process.env.SUPABASE_SINKS_BUCKET || "sinks-assets";

function extractStoragePathFromUrl(url: string | null | undefined) {
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

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getProgramUserContext("sinks");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const prismaAny = prisma as any;

    const sink = await prismaAny.sink.findUnique({
      where: { id },
      select: { id: true, brandId: true, model: true, imageUrl: true },
    });

    if (!sink) {
      return NextResponse.json({ error: "Sink not found" }, { status: 404 });
    }

    const sinkImageUrl = sink.imageUrl ? String(sink.imageUrl) : null;

    const modelImage = await prismaAny.sinkModelImage.findUnique({
      where: {
        brandId_model: {
          brandId: sink.brandId,
          model: sink.model,
        },
      },
      select: { imageUrl: true },
    });

    await prismaAny.$transaction(async (tx: any) => {
      await tx.sink.updateMany({
        where: {
          brandId: sink.brandId,
          model: sink.model,
        },
        data: { imageUrl: null },
      });

      await tx.sinkModelImage.deleteMany({
        where: {
          brandId: sink.brandId,
          model: sink.model,
        },
      });
    });

    const urlsToRemove = new Set<string>();
    if (sinkImageUrl) {
      urlsToRemove.add(sinkImageUrl);
    }
    if (modelImage?.imageUrl) {
      urlsToRemove.add(String(modelImage.imageUrl));
    }

    const storagePaths = Array.from(urlsToRemove)
      .map((url) => extractStoragePathFromUrl(url))
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(storagePaths);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove sink image" },
      { status: 500 },
    );
  }
}
