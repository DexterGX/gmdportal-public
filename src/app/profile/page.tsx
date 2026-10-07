import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import UsersManagementClient from "./UsersManagementClient";
import {
  isProgramAdminEligible,
  mapDbRoleToAppRole,
  programs,
} from "@/lib/programsConfig";
import { getEffectiveProgramAccessMap } from "@/lib/programAccess";

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
      programAdminFor: true,
      active: true,
    },
  });

  // Programs that support a per-user "Program Admin" level, with the roles
  // allowed into each one (Settings → Program Access). null = open to all.
  const accessMap = await getEffectiveProgramAccessMap();
  const programAdminOptions = programs
    .filter((program) => isProgramAdminEligible(program.id))
    .map((program) => ({
      id: program.id,
      name: program.name,
      allowedRoles: accessMap[program.id] ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
      programAdminFor: (user.programAdminFor || []).filter(
        (value): value is string => typeof value === "string" && Boolean(value)
      ),
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
      <UsersManagementClient
        users={usersForClient}
        canManage={canManage}
        programAdminOptions={programAdminOptions}
      />
    </div>
  );
}
