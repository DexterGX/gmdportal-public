import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

export async function requireAdmin() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (appRole !== "admin") {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

export const apiKeySelect = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  isActive: true,
  expiresAt: true,
  lastUsedAt: true,
  lastUsedIp: true,
  usageCount: true,
  notes: true,
  createdAt: true,
  revokedAt: true,
  createdBy: { select: { id: true, name: true } },
  revokedBy: { select: { id: true, name: true } },
};
