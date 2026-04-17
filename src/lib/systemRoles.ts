import "server-only";

import { prisma } from "@/lib/prisma";
import { ASSIGNABLE_APP_ROLES } from "@/lib/programsConfig";

export type SystemRole = {
  key: string;
  label: string;
  isBuiltIn: boolean;
  isActive: boolean;
};

function toLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function ensureBuiltInSystemRoles() {
  for (const role of ASSIGNABLE_APP_ROLES) {
    await prisma.systemRoleSetting.upsert({
      where: { key: role },
      update: {
        label: toLabel(role),
        isBuiltIn: true,
        isActive: true,
      },
      create: {
        key: role,
        label: toLabel(role),
        isBuiltIn: true,
        isActive: true,
      },
    });
  }
}

export async function getActiveSystemRoles(): Promise<SystemRole[]> {
  await ensureBuiltInSystemRoles();

  const roles = await prisma.systemRoleSetting.findMany({
    where: { isActive: true },
    orderBy: [{ isBuiltIn: "desc" }, { label: "asc" }],
  });

  return roles.map((role) => ({
    key: role.key,
    label: role.label,
    isBuiltIn: role.isBuiltIn,
    isActive: role.isActive,
  }));
}

export async function getActiveSystemRoleKeys(): Promise<string[]> {
  const roles = await getActiveSystemRoles();
  return roles.map((role) => role.key);
}
