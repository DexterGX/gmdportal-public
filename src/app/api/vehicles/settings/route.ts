import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

const VIEW_ROLES = [
  "admin",
  "sales",
  "office",
  "finance",
  "specialist",
  "installer",
];

async function getOrCreateSettings() {
  const existing = await prismaAny.vehicleProgramSettings.findFirst();
  if (existing) return existing;
  return prismaAny.vehicleProgramSettings.create({ data: {} });
}

export async function GET() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getOrCreateSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const defaultOilChangeIntervalMiles = Number(
      body.defaultOilChangeIntervalMiles,
    );
    const dueSoonThresholdMiles = Number(body.dueSoonThresholdMiles);

    if (
      !Number.isFinite(defaultOilChangeIntervalMiles) ||
      defaultOilChangeIntervalMiles <= 0
    ) {
      return NextResponse.json(
        { error: "Default interval must be a positive number" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(dueSoonThresholdMiles) || dueSoonThresholdMiles < 0) {
      return NextResponse.json(
        { error: "Due-soon threshold must be zero or more" },
        { status: 400 },
      );
    }

    const existing = await getOrCreateSettings();
    const updated = await prismaAny.vehicleProgramSettings.update({
      where: { id: existing.id },
      data: { defaultOilChangeIntervalMiles, dueSoonThresholdMiles },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to update vehicle settings", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update settings" },
      { status: 500 },
    );
  }
}
