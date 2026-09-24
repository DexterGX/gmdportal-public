import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeScopes } from "@/lib/apiKeys";
import { apiKeySelect, requireAdmin } from "../shared";

const prismaAny = prisma as any;

/**
 * PATCH body (all optional):
 *   action: "revoke" | "reactivate"
 *   name, notes, scopes, expiresAt (ISO or null)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const existing = await prismaAny.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body?.action === "revoke") {
      data.isActive = false;
      data.revokedAt = new Date();
      data.revokedById = auth.user.id;
    } else if (body?.action === "reactivate") {
      data.isActive = true;
      data.revokedAt = null;
      data.revokedById = null;
    }

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      data.name = name;
    }
    if (typeof body?.notes === "string") data.notes = body.notes.trim() || null;
    if (Array.isArray(body?.scopes)) {
      const scopes = normalizeScopes(body.scopes);
      if (!scopes.some((scope) => scope !== "pricing:read")) {
        return NextResponse.json(
          { error: "Pick at least one program the key can read" },
          { status: 400 },
        );
      }
      data.scopes = scopes;
    }
    if (body && "expiresAt" in body) {
      if (!body.expiresAt) {
        data.expiresAt = null;
      } else {
        const parsed = new Date(body.expiresAt);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid expiration date" }, { status: 400 });
        }
        data.expiresAt = parsed;
      }
    }

    const updated = await prismaAny.apiKey.update({
      where: { id },
      data,
      select: apiKeySelect,
    });
    return NextResponse.json({ key: updated });
  } catch (error: any) {
    console.error("Failed to update API key", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update API key" },
      { status: 500 },
    );
  }
}

// Permanent delete. Only allowed for keys that are already revoked, so an
// in-use key can't be wiped by a single mis-click.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const existing = await prismaAny.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }
    if (existing.isActive) {
      return NextResponse.json(
        { error: "Revoke the key before permanently deleting it" },
        { status: 400 },
      );
    }
    await prismaAny.apiKey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to delete API key", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete API key" },
      { status: 500 },
    );
  }
}
