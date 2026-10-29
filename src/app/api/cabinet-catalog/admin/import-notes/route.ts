import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

const MAX_NOTES = 50;

async function requireAdmin() {
  const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

/** GET /api/cabinet-catalog/admin/import-notes - notes previously given to the import AI, newest first. */
export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const notes = await prismaAny.cabinetImportNote.findMany({
      orderBy: { updatedAt: "desc" },
      take: MAX_NOTES,
      select: { id: true, text: true, vendorName: true, updatedAt: true },
    });
    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error("Cabinet import notes list error:", error);
    return NextResponse.json({ error: "Failed to load notes history" }, { status: 500 });
  }
}

/**
 * POST /api/cabinet-catalog/admin/import-notes - remember notes given to the AI.
 * The same text is not stored twice (it just moves to the top again).
 */
export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
    const vendorName = typeof body.vendorName === "string" ? body.vendorName.trim().slice(0, 200) : "";
    if (!text) {
      return NextResponse.json({ error: "Notes are empty" }, { status: 400 });
    }

    const existing = await prismaAny.cabinetImportNote.findFirst({ where: { text } });
    if (existing) {
      await prismaAny.cabinetImportNote.update({
        where: { id: existing.id },
        data: { vendorName, updatedAt: new Date() },
      });
    } else {
      await prismaAny.cabinetImportNote.create({ data: { text, vendorName } });
      // Keep the history from growing forever: drop the oldest beyond the cap.
      const stale = await prismaAny.cabinetImportNote.findMany({
        orderBy: { updatedAt: "desc" },
        skip: MAX_NOTES,
        select: { id: true },
      });
      if (stale.length > 0) {
        await prismaAny.cabinetImportNote.deleteMany({
          where: { id: { in: stale.map((n: any) => n.id) } },
        });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cabinet import notes save error:", error);
    return NextResponse.json({ error: "Failed to save notes" }, { status: 500 });
  }
}

/** DELETE /api/cabinet-catalog/admin/import-notes - clears the whole history. */
export async function DELETE() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await prismaAny.cabinetImportNote.deleteMany({});
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error: any) {
    console.error("Cabinet import notes clear error:", error);
    return NextResponse.json({ error: "Failed to clear notes history" }, { status: 500 });
  }
}
