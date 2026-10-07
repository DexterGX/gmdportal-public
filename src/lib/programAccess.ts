import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getDefaultAllowedRolesForProgram,
  programs,
  type ProgramId,
} from "@/lib/programsConfig";
import { normalizeRoleKey } from "@/lib/systemRoles";

export const PROGRAM_ACCESS_MANAGED_IDS = programs
  .filter((program) => program.id !== "main")
  .map((program) => program.id);

export type ProgramAccessMap = Partial<Record<ProgramId, string[] | undefined>>;

function isProgramId(value: string): value is ProgramId {
  return programs.some((program) => program.id === value);
}

function normalizeRoles(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeRoleKey(value))
        .filter(Boolean)
    )
  );
}

export async function getEffectiveProgramAccessMap(): Promise<ProgramAccessMap> {
  const stored = await prisma.programAccessSetting.findMany();

  const map: ProgramAccessMap = {};

  for (const program of programs) {
    map[program.id] = getDefaultAllowedRolesForProgram(program.id);
  }

  for (const row of stored) {
    if (!isProgramId(row.programId)) {
      continue;
    }

    map[row.programId] = normalizeRoles(row.allowedRoles);
  }

  return map;
}

/**
 * Pure check against an already-loaded access map (no DB call). Use this when
 * checking many users/programs at once (e.g. the Users & Profiles page).
 */
export function rolesCanAccessProgram(
  accessMap: ProgramAccessMap,
  programId: ProgramId,
  roles: string[],
  isActive: boolean
): boolean {
  if (!isActive || roles.length === 0) {
    return false;
  }

  const allowedRoles = accessMap[programId];
  if (allowedRoles === undefined) {
    return true;
  }

  return roles.some((role) => allowedRoles.includes(role));
}

export function computeAccessibleProgramIds(
  accessMap: ProgramAccessMap,
  roles: string[],
  isActive: boolean
): ProgramId[] {
  return programs
    .filter((program) =>
      rolesCanAccessProgram(accessMap, program.id, roles, isActive)
    )
    .map((program) => program.id);
}

export async function canAccessProgramId(
  programId: ProgramId,
  roles: string[],
  isActive: boolean
): Promise<boolean> {
  if (!isActive || roles.length === 0) {
    return false;
  }

  const accessMap = await getEffectiveProgramAccessMap();
  return rolesCanAccessProgram(accessMap, programId, roles, isActive);
}

export async function getAccessibleProgramIds(
  roles: string[],
  isActive: boolean
): Promise<ProgramId[]> {
  const accessMap = await getEffectiveProgramAccessMap();
  return computeAccessibleProgramIds(accessMap, roles, isActive);
}

export function getProgramAccessManagedIds(): ProgramId[] {
  return [...PROGRAM_ACCESS_MANAGED_IDS];
}

export function normalizeProgramAccessRoles(input: unknown): string[] {
  return normalizeRoles(input);
}
