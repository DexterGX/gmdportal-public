import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  ensureBuiltInSystemRoles,
  getActiveSystemRoles,
  normalizeRoleKey,
} from "@/lib/systemRoles";

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

function toLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function GET() {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const roles = await getActiveSystemRoles();
    return NextResponse.json({ roles });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const raw = typeof body?.role === "string" ? body.role : "";
    const key = normalizeRoleKey(raw);

    if (!key) {
      return NextResponse.json({ error: "Role cannot be empty" }, { status: 400 });
    }

    await ensureBuiltInSystemRoles();

    const existing = await prisma.systemRoleSetting.findUnique({ where: { key } });
    if (existing?.isActive) {
      return NextResponse.json({ error: "Role already exists" }, { status: 400 });
    }

    await prisma.systemRoleSetting.upsert({
      where: { key },
      update: {
        label: toLabel(key),
        isActive: true,
      },
      create: {
        key,
        label: toLabel(key),
        isBuiltIn: false,
        isActive: true,
      },
    });

    const roles = await getActiveSystemRoles();
    return NextResponse.json({ roles });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to add role" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const key = normalizeRoleKey(typeof body?.roleKey === "string" ? body.roleKey : "");

    if (!key) {
      return NextResponse.json({ error: "Missing role key" }, { status: 400 });
    }

    await ensureBuiltInSystemRoles();

    const role = await prisma.systemRoleSetting.findUnique({ where: { key } });
    if (!role || !role.isActive) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (role.isBuiltIn) {
      return NextResponse.json(
        { error: "Built-in roles cannot be removed" },
        { status: 400 }
      );
    }

    const usedByPrograms = await prisma.programAccessSetting.findFirst({
      where: {
        allowedRoles: {
          has: key,
        },
      },
      select: { id: true },
    });

    if (usedByPrograms) {
      return NextResponse.json(
        { error: "Remove this role from Program Access before deleting it" },
        { status: 400 }
      );
    }

    const usedByUsers = await prisma.user.findFirst({
      where: {
        roles: {
          has: key,
        },
      },
      select: { id: true },
    });

    if (usedByUsers) {
      return NextResponse.json(
        { error: "Remove this role from all users before deleting it" },
        { status: 400 }
      );
    }

    await prisma.systemRoleSetting.update({
      where: { key },
      data: { isActive: false },
    });

    const roles = await getActiveSystemRoles();
    return NextResponse.json({ roles });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove role" },
      { status: 500 }
    );
  }
}
