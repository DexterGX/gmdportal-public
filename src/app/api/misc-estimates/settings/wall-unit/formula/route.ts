import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

type WallUnitFormulaBody = {
  constructionPricePerSqFt?: number;
};

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  try {
    const { user, appRole, isActive, appRoles } = await getProgramUserContext("miscEstimates");

    if (!user || !isActive || appRoles.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as WallUnitFormulaBody;
    const existing = await prismaAny.miscWallUnitSetting.findFirst();

    const data = {
      constructionPricePerSqFt: asNumber(body.constructionPricePerSqFt),
    };

    const saved = existing
      ? await prismaAny.miscWallUnitSetting.update({
          where: { id: existing.id },
          data,
        })
      : await prismaAny.miscWallUnitSetting.create({ data });

    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save wall unit formula settings" },
      { status: 500 },
    );
  }
}
