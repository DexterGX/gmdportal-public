import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  try {
    const { user, appRole, isActive } = await getCurrentUserWithRole();

    if (!user || !isActive || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "sales", "office"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "1" &&
      appRole === "admin";

    const [rooms, ledTypes, controlTypes, profiles] = await Promise.all([
      prismaAny.miscLedRoom.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscLedType.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscLedControlType.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscLedProfile.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json({
      rooms,
      ledTypes: ledTypes.map((item: any) => ({
        ...item,
        minimumPriceUnder25Ft: toNumber(item.minimumPriceUnder25Ft),
        pricePerFt: toNumber(item.pricePerFt),
      })),
      controlTypes: controlTypes.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
      })),
      profiles: profiles.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
        groovePricePerFt: toNumber(item.groovePricePerFt),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load LED settings" },
      { status: 500 },
    );
  }
}
