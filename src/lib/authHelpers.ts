import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "./programsConfig";

// Map Prisma Role enum ("ADMIN", "INVENTORY", etc.) to AppRole
function mapDbRoleToAppRole(dbRole: string | null | undefined): AppRole {
  switch (dbRole) {
    case "ADMIN":
      return "admin";
    case "INVENTORY":
      return "inventory";
    case "SALES":
      return "sales";
    case "VIEWER":
      return "viewer";
    case "UNASSIGNED":
    default:
      return "unassigned";
  }
}

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
    return { user: null, appRole: "unassigned" as AppRole, isActive: false };
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      active: true,
    },
  });

  if (!dbUser) {
    return { user: null, appRole: "unassigned" as AppRole, isActive: false };
  }

  const appRole = mapDbRoleToAppRole(dbUser.role);
  return { user: dbUser, appRole, isActive: dbUser.active };
}
