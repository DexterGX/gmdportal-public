import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import UsersManagementClient from "./UsersManagementClient";

export default async function ProfilePage() {
  const { appRole, isActive } = await getCurrentUserWithRole();

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      active: true,
    },
  });

  const isAdmin = appRole === "admin";
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
      <UsersManagementClient users={users} canManage={canManage} />
    </div>
  );
}
