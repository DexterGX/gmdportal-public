import { canAccessProgramId } from "@/lib/programAccess";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

export async function requireSalesCommissionAccess() {
  const { user, appRole, appRoles, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRoles.length === 0) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      appRole,
      userId: null,
    };
  }

  const hasAccess = await canAccessProgramId(
    "salesCommission",
    appRoles,
    isActive,
  );
  if (!hasAccess) {
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
