import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { ASSIGNABLE_APP_ROLES } from "@/lib/programsConfig";
import { normalizeRoleKey } from "@/lib/systemRoles";

export async function POST(req: Request) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  // Only active admins can manage users
  if (!user || appRole !== "admin" || !isActive) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const { userId, role, roles, active } = body as {
    userId: string;
    role?: string;
    roles?: string[];
    active?: boolean;
  };

  if (!userId) {
    return new NextResponse("Missing userId", { status: 400 });
  }

  const builtInRoleByAppKey: Record<string, string> = {
    admin: "ADMIN",
    sales: "SALES",
    office: "OFFICE",
    finance: "FINANCE",
    specialist: "SPECIALIST",
    installer: "INSTALLER",
  };

  const activeRoles = await prisma.systemRoleSetting.findMany({
    where: { isActive: true },
    select: { key: true },
  });

  const allowedRoles = new Set(activeRoles.map((item) => item.key));

  const data: any = {};

  if (Array.isArray(roles)) {
    const normalized = Array.from(
      new Set(
        roles
          .filter((value): value is string => typeof value === "string")
          .map((value) => normalizeRoleKey(value))
          .filter((value) => allowedRoles.has(value))
      )
    );

    const cleaned = normalized.filter((value) => value !== "unassigned");

    data.roles = cleaned;
    const firstBuiltIn = cleaned.find((value) =>
      ASSIGNABLE_APP_ROLES.includes(value as (typeof ASSIGNABLE_APP_ROLES)[number])
    );
    data.role = firstBuiltIn ? builtInRoleByAppKey[firstBuiltIn] : "UNASSIGNED";
  } else if (role) {
    const normalized = normalizeRoleKey(role);
    if (normalized && normalized !== "unassigned" && allowedRoles.has(normalized)) {
      data.roles = [normalized];
      data.role = builtInRoleByAppKey[normalized] || "UNASSIGNED";
    } else {
      data.roles = [];
      data.role = "UNASSIGNED";
    }
  }

  if (typeof active === "boolean") data.active = active;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, role: true, roles: true, active: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  // Only active admins can delete users
  if (!user || appRole !== "admin" || !isActive) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const { userId } = body as { userId: string };

  if (!userId) {
    return new NextResponse("Missing userId", { status: 400 });
  }

  // Prevent admins from deleting themselves
  if (userId === user.id) {
    return new NextResponse("Cannot delete your own account", { status: 400 });
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    return new NextResponse("User deleted successfully", { status: 200 });
  } catch (error) {
    console.error("Error deleting user:", error);
    return new NextResponse("Failed to delete user", { status: 500 });
  }
}
