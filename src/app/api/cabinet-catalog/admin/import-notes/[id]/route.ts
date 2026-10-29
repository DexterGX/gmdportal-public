import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

/** DELETE /api/cabinet-catalog/admin/import-notes/[id] - removes one remembered note. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
    if (!user || !isActive || appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await prismaAny.cabinetImportNote.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cabinet import note delete error:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
