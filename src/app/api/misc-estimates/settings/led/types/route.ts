import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

type LedTypeBody = {
  id?: string;
  name?: string;
  minimumPriceUnder25Ft?: number;
  pricePerFt?: number;
  sortOrder?: number;
  active?: boolean;
  action?: "save" | "deactivate" | "activate";
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

    const body = (await request.json()) as LedTypeBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    if (action === "deactivate" || action === "activate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }

      const updated = await prismaAny.miscLedType.update({
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
    const minimumPriceUnder25Ft = Number.isFinite(body.minimumPriceUnder25Ft)
      ? Number(body.minimumPriceUnder25Ft)
      : 0;
    const pricePerFt = Number.isFinite(body.pricePerFt)
      ? Number(body.pricePerFt)
      : 0;

    if (id) {
      const updated = await prismaAny.miscLedType.update({
        where: { id },
        data: { name, minimumPriceUnder25Ft, pricePerFt, sortOrder, active },
      });
      return NextResponse.json(updated);
    }

    const created = await prismaAny.miscLedType.create({
      data: { name, minimumPriceUnder25Ft, pricePerFt, sortOrder, active },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    const message =
      error?.code === "P2002"
        ? "LED type name must be unique"
        : "Failed to save LED type";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
