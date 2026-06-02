import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

type SheetTypeBody = {
  id?: string;
  name?: string;
  minimumPrice?: number;
  unitPrice?: number;
  sortOrder?: number;
  active?: boolean;
  action?: "save" | "deactivate" | "activate";
};

export async function POST(request: Request) {
  try {
    const { user, appRole, isActive } = await getCurrentUserWithRole();

    if (!user || !isActive || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as SheetTypeBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    if (action === "deactivate" || action === "activate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      const updated = await prismaAny.miscLedSheetType.update({
        where: { id },
        data: { active: action === "activate" },
      });

      return NextResponse.json(updated);
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const sortOrder = Number.isFinite(body.sortOrder)
      ? Number(body.sortOrder)
      : 0;
    const active = body.active !== false;
    const unitPrice = Number.isFinite(body.unitPrice)
      ? Number(body.unitPrice)
      : 0;
    const minimumPrice = Number.isFinite(body.minimumPrice)
      ? Number(body.minimumPrice)
      : 0;

    if (id) {
      const updated = await prismaAny.miscLedSheetType.update({
        where: { id },
        data: { name, minimumPrice, unitPrice, sortOrder, active },
      });
      return NextResponse.json(updated);
    }

    const created = await prismaAny.miscLedSheetType.create({
      data: { name, minimumPrice, unitPrice, sortOrder, active },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    const message =
      error?.code === "P2002"
        ? "Sheet type name must be unique"
        : "Failed to save sheet type";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
