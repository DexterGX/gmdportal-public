import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

type IslandPanelModelBody = {
  id?: string;
  name?: string;
  sfPerBox?: number;
  cost?: number;
  salesPrice?: number;
  link?: string;
  imageUrl?: string;
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

    const body = (await request.json()) as IslandPanelModelBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    if (action === "deactivate" || action === "activate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      const updated = await prismaAny.miscIslandPanelModel.update({
        where: { id },
        data: { active: action === "activate" },
      });

      return NextResponse.json(updated);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      await prismaAny.miscIslandPanelModel.delete({ where: { id } });
      return NextResponse.json({ success: true, id });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const sfPerBox = Number.isFinite(body.sfPerBox) ? Number(body.sfPerBox) : 0;
    const cost = Number.isFinite(body.cost) ? Number(body.cost) : 0;
    const salesPrice = Number.isFinite(body.salesPrice)
      ? Number(body.salesPrice)
      : 0;
    const sortOrder = Number.isFinite(body.sortOrder)
      ? Number(body.sortOrder)
      : 0;
    const active = body.active !== false;

    const data = {
      name,
      sfPerBox,
      cost,
      salesPrice,
      link: body.link?.trim() || null,
      imageUrl: body.imageUrl?.trim() || null,
      sortOrder,
      active,
    };

    if (id) {
      const updated = await prismaAny.miscIslandPanelModel.update({
        where: { id },
        data,
      });
      return NextResponse.json(updated);
    }

    const created = await prismaAny.miscIslandPanelModel.create({ data });
    return NextResponse.json(created);
  } catch (error: any) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Unable to delete panel model because it is used by estimate rows.",
        },
        { status: 400 },
      );
    }

    const message =
      error?.code === "P2002"
        ? "Panel model name must be unique"
        : "Failed to save panel model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
