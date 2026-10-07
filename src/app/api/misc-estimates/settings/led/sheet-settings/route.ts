import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

type SheetSettingBody = {
  minimumSheetPrice?: number;
};

async function getOrCreateSheetSetting() {
  const existing = await prismaAny.miscLedSheetSetting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prismaAny.miscLedSheetSetting.create({
    data: {
      minimumSheetPrice: 0,
    },
  });
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

    const body = (await request.json()) as SheetSettingBody;
    const minimumSheetPrice = Number.isFinite(body.minimumSheetPrice)
      ? Number(body.minimumSheetPrice)
      : 0;

    const current = await getOrCreateSheetSetting();
    const updated = await prismaAny.miscLedSheetSetting.update({
      where: { id: current.id },
      data: { minimumSheetPrice },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save sheet settings" },
      { status: 500 },
    );
  }
}
