import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import UsersManagementClient from "./UsersManagementClient";
import { mapDbRoleToAppRole } from "@/lib/programsConfig";

export default async function ProfilePage() {
  const { appRole, isActive } = await getCurrentUserWithRole();

  const isAdmin = appRole === "admin";

  // Admins see all users, non-admins only see active users
  const users = await prisma.user.findMany({
    where: isAdmin ? undefined : { active: true },
    orderBy: { name: "asc" },
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

  const usersForClient = users.map((user) => {
    const normalizedRoles = Array.from(
      new Set(
        (user.roles || [])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    return {
      ...user,
      role: mapDbRoleToAppRole(user.role),
      roles: normalizedRoles,
    };
  });

  const canManage = isAdmin && isActive;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
        Users & Profiles
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        View all users of the portal
        {canManage ? " and manage their access." : "."}
      </p>

      {/* Client component adds interactivity for admin; read-only for others */}
      <UsersManagementClient users={usersForClient} canManage={canManage} />
    </div>
  );
}
