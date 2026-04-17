import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  getEffectiveProgramAccessMap,
  getProgramAccessManagedIds,
  normalizeProgramAccessRoles,
} from "@/lib/programAccess";
import { programs } from "@/lib/programsConfig";
import { getActiveSystemRoleKeys, getActiveSystemRoles } from "@/lib/systemRoles";

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { error: null };
}

export async function GET() {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const managedIds = new Set(getProgramAccessManagedIds());
    const accessMap = await getEffectiveProgramAccessMap();
    const roles = await getActiveSystemRoles();

    const rows = programs
      .filter((program) => managedIds.has(program.id))
      .map((program) => ({
        programId: program.id,
        name: program.name,
        description: program.description ?? "",
        basePath: program.basePath,
        allowedRoles: accessMap[program.id] ?? [],
      }));

    return NextResponse.json({ programs: rows, roles });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch program access settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const programId =
      typeof body?.programId === "string" ? body.programId.trim() : "";
    const managedIds = getProgramAccessManagedIds();

    if (!managedIds.includes(programId as (typeof managedIds)[number])) {
      return NextResponse.json(
        { error: "Invalid program id" },
        { status: 400 }
      );
    }

    const activeRoleKeys = new Set(await getActiveSystemRoleKeys());
    const allowedRoles = normalizeProgramAccessRoles(body?.allowedRoles).filter((role) =>
      activeRoleKeys.has(role)
    );

    await prisma.programAccessSetting.upsert({
      where: { programId },
      update: { allowedRoles },
      create: { programId, allowedRoles },
    });

    return NextResponse.json({
      programId,
      allowedRoles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update program access settings" },
      { status: 500 }
    );
  }
}
