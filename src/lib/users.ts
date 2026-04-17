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
      OR: [
        { roles: { has: "installer" } },
        { role: "INSTALLER" },
      ],
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: true,
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

/**
 * Shared helper to fetch all active users that can be assigned as sales person.
 */
export async function getSalesAssignableUsers() {
  return prisma.user.findMany({
    where: {
      OR: [
        { roles: { hasSome: ["admin", "sales"] } },
        {
          role: {
            in: ["ADMIN", "SALES"],
          },
        },
      ],
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: true,
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}
