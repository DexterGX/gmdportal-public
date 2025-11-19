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
  const session = await getServerSession(authOptions);

  // If not logged in, treat as unassigned
  if (!session?.user?.email) {
    return "unassigned";
  }

  // Always read the role FROM THE DATABASE so changing it in Prisma Studio
  // takes effect immediately without logout/login.
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  return mapDbRoleToAppRole(dbUser?.role ?? "UNASSIGNED");
}
