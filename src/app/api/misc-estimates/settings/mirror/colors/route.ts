import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

type MirrorColorBody = {
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
    const { user, appRole, isActive, appRoles } = await getProgramUserContext("miscEstimates");

    if (!user || !isActive || appRoles.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as MirrorColorBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    if (action === "deactivate" || action === "activate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      const updated = await prismaAny.miscMirrorColor.update({
        where: { id },
        data: { active: action === "activate" },
      });

      return NextResponse.json(updated);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      await prismaAny.miscMirrorColor.delete({ where: { id } });
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
      const updated = await prismaAny.miscMirrorColor.update({
        where: { id },
        data: { name, venda, custo, sortOrder, active },
      });
      return NextResponse.json(updated);
    }

    const created = await prismaAny.miscMirrorColor.create({
      data: { name, venda, custo, sortOrder, active },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          error: "Unable to delete color because it is used by estimate rows.",
        },
        { status: 400 },
      );
    }

    const message =
      error?.code === "P2002"
        ? "Mirror color name must be unique"
        : "Failed to save mirror color";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
