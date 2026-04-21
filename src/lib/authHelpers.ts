import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_ROLES, type AppRole } from "./programsConfig";
import {
  getPrimaryAppRoleFromRoles,
  mapDbRoleToAppRole,
} from "./programsConfig";
import { normalizeRoleKey } from "@/lib/systemRoles";

export async function getCurrentUserRole(): Promise<AppRole> {
  const { appRole, isActive } = await getCurrentUserWithRole();
  if (!isActive) {
    // Inactive users should have no effective permissions
    return "unassigned";
  }
  return appRole;
}

export async function getCurrentUserWithRole() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return {
      user: null,
      appRole: "unassigned" as AppRole,
      appRoles: [] as string[],
      isActive: false,
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      roles: true,
      active: true,
    },
  });

  if (!dbUser) {
    return {
      user: null,
      appRole: "unassigned" as AppRole,
      appRoles: [] as string[],
      isActive: false,
    };
  }

  const multiRoles = Array.from(
    new Set(
      ((dbUser.roles as string[]) || [])
        .map((value: string) => normalizeRoleKey(value))
        .filter(Boolean),
    ),
  );
  const fallbackRole = mapDbRoleToAppRole(dbUser.role);
  const appRoles = multiRoles.length
    ? multiRoles
    : fallbackRole === "unassigned"
      ? []
      : [fallbackRole];

  const knownRoles = appRoles.filter((value): value is AppRole =>
    APP_ROLES.includes(value as AppRole),
  );
  const appRole = getPrimaryAppRoleFromRoles(knownRoles);
  return {
    user: dbUser,
    appRole,
    appRoles: appRoles as string[],
    isActive: dbUser.active,
  };
}
