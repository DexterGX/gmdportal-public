import "server-only";

import { cache } from "react";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import {
  computeAccessibleProgramIds,
  getEffectiveProgramAccessMap,
  rolesCanAccessProgram,
} from "@/lib/programAccess";
import {
  isProgramAdminEligible,
  type AppRole,
  type ProgramId,
} from "@/lib/programsConfig";

/**
 * Single source of truth for "what can the current user do inside program X".
 *
 * - canAccess:       may enter the program (Settings → Program Access, by role).
 * - isProgramAdmin:  highest access level inside the program — global Admin
 *                    role, or a per-user "Program Admin" grant from
 *                    Users & Profiles (only effective while canAccess is true).
 * - appRole:         the user's EFFECTIVE role inside this program. It is
 *                    "admin" whenever isProgramAdmin is true, so existing
 *                    `appRole === "admin"` checks and workflow rules
 *                    (installer/sales/office…) automatically grant Program
 *                    Admins full access. baseAppRole keeps the real role.
 */
export function computeIsProgramAdmin(input: {
  programId: ProgramId;
  appRoles: string[];
  programAdminFor: string[];
  isActive: boolean;
  canAccess: boolean;
}): boolean {
  if (!input.isActive) return false;
  if (input.appRoles.includes("admin")) return true;
  if (!input.canAccess) return false;
  return (
    isProgramAdminEligible(input.programId) &&
    input.programAdminFor.includes(input.programId)
  );
}

async function loadProgramUserContext(programId: ProgramId) {
  const base = await getCurrentUserWithRole();
  const accessMap = await getEffectiveProgramAccessMap();

  const canAccess = rolesCanAccessProgram(
    accessMap,
    programId,
    base.appRoles,
    base.isActive
  );
  const isGlobalAdmin = base.isActive && base.appRoles.includes("admin");
  const isProgramAdmin = computeIsProgramAdmin({
    programId,
    appRoles: base.appRoles,
    programAdminFor: base.programAdminFor,
    isActive: base.isActive,
    canAccess,
  });
  const accessibleProgramIds = computeAccessibleProgramIds(
    accessMap,
    base.appRoles,
    base.isActive
  );

  return {
    ...base,
    programId,
    baseAppRole: base.appRole,
    appRole: (isProgramAdmin ? "admin" : base.appRole) as AppRole,
    canAccess,
    isGlobalAdmin,
    isProgramAdmin,
    accessibleProgramIds,
  };
}

export type ProgramUserContext = Awaited<
  ReturnType<typeof loadProgramUserContext>
>;

/** Cached per request, so layouts, pages and helpers can all call it. */
export const getProgramUserContext = cache(loadProgramUserContext);

/**
 * True when the user can enter at least one of the given programs. Useful for
 * shared pages (e.g. print views opened from Customers and from the source
 * program).
 */
export async function canAccessAnyProgram(programIds: ProgramId[]) {
  for (const programId of programIds) {
    const ctx = await getProgramUserContext(programId);
    if (ctx.canAccess) return true;
  }
  return false;
}

/**
 * Convenience guard for API routes. Returns the context when the user is
 * signed in, active and allowed into the program; otherwise an error status.
 * Pass { admin: true } to require the Program Admin level.
 */
export async function requireProgramAccess(
  programId: ProgramId,
  options: { admin?: boolean } = {}
) {
  const ctx = await getProgramUserContext(programId);

  if (!ctx.user || !ctx.isActive) {
    return { ok: false as const, status: 401, error: "Unauthorized", ctx };
  }

  if (options.admin ? !ctx.isProgramAdmin : !ctx.canAccess) {
    return { ok: false as const, status: 403, error: "Forbidden", ctx };
  }

  return { ok: true as const, ctx };
}
