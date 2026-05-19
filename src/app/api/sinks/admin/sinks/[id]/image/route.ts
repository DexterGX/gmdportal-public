import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET_NAME = process.env.SUPABASE_SINKS_BUCKET || "sinks-assets";

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

    const sink = await prismaAny.sink.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    if (!sink) {
      return NextResponse.json({ error: "Sink not found" }, { status: 404 });
    }

    const imageUrl = sink.imageUrl ? String(sink.imageUrl) : null;

    await prismaAny.sink.update({
      where: { id },
      data: { imageUrl: null },
    });

    if (imageUrl && imageUrl.includes(`${BUCKET_NAME}/`)) {
      const marker = `${BUCKET_NAME}/`;
      const markerIndex = imageUrl.indexOf(marker);
      const storagePath =
        markerIndex !== -1 ? imageUrl.slice(markerIndex + marker.length) : null;
      if (storagePath) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove sink image" },
      { status: 500 },
    );
  }
}
