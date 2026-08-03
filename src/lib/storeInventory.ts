import "server-only";

import { prisma } from "@/lib/prisma";

// Starter taxonomy seeded on first use. Admins can add/rename/deactivate
// entries from /store-inventory/settings — this list only fills the module
// so it isn't empty on day one.
export const STARTER_DEPARTMENTS: { key: string; label: string; sortOrder: number }[] = [
  { key: "cabinet-shop", label: "Cabinet Shop", sortOrder: 0 },
  { key: "countertop-shop", label: "Countertop Shop", sortOrder: 1 },
  { key: "installation", label: "Installation", sortOrder: 2 },
  { key: "office", label: "Office / General", sortOrder: 3 },
];

export const STARTER_GROUPS: { key: string; label: string; sortOrder: number }[] = [
  { key: "leds", label: "LEDs", sortOrder: 0 },
  { key: "plumbing", label: "Plumbing", sortOrder: 1 },
  { key: "adhesives", label: "Adhesives & Sealants", sortOrder: 2 },
  { key: "fasteners", label: "Fasteners & Hardware", sortOrder: 3 },
  { key: "safety", label: "Safety Equipment", sortOrder: 4 },
  { key: "packaging", label: "Packaging & Protection", sortOrder: 5 },
  { key: "electrical", label: "Electrical", sortOrder: 6 },
  { key: "tools", label: "Tools & Consumables", sortOrder: 7 },
];

let seeded = false;

/**
 * Upserts the starter Departments/Groups once per server lifetime.
 * Safe to call repeatedly — it's an idempotent upsert on unique `key`.
 */
export async function ensureStoreTaxonomySeeded() {
  if (seeded) return;

  await Promise.all([
    ...STARTER_DEPARTMENTS.map((dept) =>
      prisma.storeDepartment.upsert({
        where: { key: dept.key },
        update: {},
        create: { ...dept, isActive: true },
      }),
    ),
    ...STARTER_GROUPS.map((group) =>
      prisma.storeGroup.upsert({
        where: { key: group.key },
        update: {},
        create: { ...group, isActive: true },
      }),
    ),
  ]);

  seeded = true;
}

export function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type StoreItemStockStatus = "critical" | "low" | "ok";

/**
 * Critical: at or below half of min quantity (or min is 0 and qty is 0).
 * Low: at or below min quantity.
 * Ok: everything else.
 */
export function getStockStatus(quantity: number, minQuantity: number): StoreItemStockStatus {
  if (quantity <= 0 || (minQuantity > 0 && quantity <= Math.floor(minQuantity / 2))) {
    return "critical";
  }
  if (minQuantity > 0 && quantity <= minQuantity) {
    return "low";
  }
  return "ok";
}

export const STORE_ROLES_CAN_MANAGE = ["admin", "specialist"] as const;
export const STORE_ROLES_CAN_USE = ["admin", "sales", "office", "specialist", "installer"] as const;
export const STORE_ROLES_CAN_ACTION_REQUESTS = ["admin", "office"] as const;

export function canManageStoreInventory(role: string) {
  return (STORE_ROLES_CAN_MANAGE as readonly string[]).includes(role);
}

export function canActionRestockRequests(role: string) {
  return (STORE_ROLES_CAN_ACTION_REQUESTS as readonly string[]).includes(role);
}
