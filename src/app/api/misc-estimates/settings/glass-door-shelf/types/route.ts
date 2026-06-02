import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

type GlassDoorShelfTypeBody = {
  id?: string;
  name?: string;
  venda?: number;
  custo?: number;
  sortOrder?: number;
  active?: boolean;
  action?: "save" | "deactivate" | "activate" | "delete";
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

    const body = (await request.json()) as GlassDoorShelfTypeBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    if (action === "deactivate" || action === "activate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      const updated = await prismaAny.miscGlassDoorShelfType.update({
        where: { id },
        data: { active: action === "activate" },
      });

      return NextResponse.json(updated);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      await prismaAny.miscGlassDoorShelfType.delete({ where: { id } });
      return NextResponse.json({ success: true, id });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const venda = Number.isFinite(body.venda) ? Number(body.venda) : 0;
    const custo = Number.isFinite(body.custo) ? Number(body.custo) : 0;
    const sortOrder = Number.isFinite(body.sortOrder)
      ? Number(body.sortOrder)
      : 0;
    const active = body.active !== false;

    if (id) {
      const updated = await prismaAny.miscGlassDoorShelfType.update({
        where: { id },
        data: { name, venda, custo, sortOrder, active },
      });
      return NextResponse.json(updated);
    }

    const created = await prismaAny.miscGlassDoorShelfType.create({
      data: { name, venda, custo, sortOrder, active },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    const message =
      error?.code === "P2002"
        ? "Glass type name must be unique"
        : "Failed to save glass type";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
