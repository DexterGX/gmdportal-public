import { getProgramUserContext } from "@/lib/programPermissions";

export async function requireSalesCommissionAccess() {
  // appRole is the effective program role ("admin" for Program Admins).
  const { user, appRole, appRoles, isActive, canAccess } =
    await getProgramUserContext("salesCommission");

  if (!user || !isActive || appRoles.length === 0) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      appRole,
      userId: null,
    };
  }

  if (!canAccess) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      appRole,
      userId: user.id,
    };
  }

  return {
    ok: true as const,
    appRole,
    userId: user.id,
    userName: user.name || user.email || "Unknown",
  };
}

export function canManageFinalizedWeeks(appRole: string) {
  return appRole === "admin";
}

// Backward-compatible alias during refactor.
export const canManageLockedPeriods = canManageFinalizedWeeks;
