import { prisma } from "./prisma";

/**
 * Shared helper to fetch all active users with INSTALLER role.
 * Used across:
 * - Closet Jobs list page (Create New Job modal)
 * - Estimate Settings page (Available Installers display)
 */
export async function getInstallers() {
  return prisma.user.findMany({
    where: {
      role: "INSTALLER",
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}
