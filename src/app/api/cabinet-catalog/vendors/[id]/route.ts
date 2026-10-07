import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

async function requireAdmin() {
  const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

/**
 * PATCH /api/cabinet-catalog/vendors/[id]
 *
 * Admin-only. Round 6: primarily used by the Cabinet Companies page to
 * link/unlink a catalog vendor to a CabinetProviderSettings company record
 * (providerId - pass null to unlink). Also supports light vendor edits
 * (name, isActive) since no other route can update a vendor once created.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, isActive, providerId } = body as {
      name?: string;
      isActive?: boolean;
      providerId?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: "Vendor name cannot be empty" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (isActive !== undefined) data.isActive = isActive;
    if (providerId !== undefined) data.providerId = providerId;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const updated = await prismaAny.cabinetVendor.update({
      where: { id },
      data,
    });

    return NextResponse.json({ vendor: updated });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "That vendor or company is already linked to something else" },
        { status: 409 },
      );
    }
    console.error("Error updating cabinet vendor:", error);
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
  }
}
