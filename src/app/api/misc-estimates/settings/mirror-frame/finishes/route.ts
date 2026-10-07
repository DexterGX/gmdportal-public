import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

type MirrorFrameFinishBody = {
  id?: string;
  name?: string;
  pricePerLinearFt?: number;
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

    const body = (await request.json()) as MirrorFrameFinishBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    if (action === "deactivate" || action === "activate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      const updated = await prismaAny.miscMirrorFrameFinish.update({
        where: { id },
        data: { active: action === "activate" },
      });

      return NextResponse.json(updated);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      await prismaAny.miscMirrorFrameFinish.delete({ where: { id } });
      return NextResponse.json({ success: true, id });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const pricePerLinearFt = Number.isFinite(body.pricePerLinearFt)
      ? Number(body.pricePerLinearFt)
      : 0;
    const sortOrder = Number.isFinite(body.sortOrder)
      ? Number(body.sortOrder)
      : 0;
    const active = body.active !== false;

    const data = {
      name,
      pricePerLinearFt,
      sortOrder,
      active,
    };

    if (id) {
      const updated = await prismaAny.miscMirrorFrameFinish.update({
        where: { id },
        data,
      });
      return NextResponse.json(updated);
    }

    const created = await prismaAny.miscMirrorFrameFinish.create({ data });
    return NextResponse.json(created);
  } catch (error: any) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          error: "Unable to delete finish because it is used by estimate rows.",
        },
        { status: 400 },
      );
    }

    const message =
      error?.code === "P2002"
        ? "Mirror frame finish name must be unique"
        : "Failed to save mirror frame finish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
