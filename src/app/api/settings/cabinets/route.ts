import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get("search") || "").trim();
    const activeFilter = searchParams.get("active") || "all";

    const where: any = {};

    if (search) {
      where.OR = [
        { actualName: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { contactPhone: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    if (activeFilter === "active") {
      where.isActive = true;
    } else if (activeFilter === "inactive") {
      where.isActive = false;
    }

    const providers = await prismaAny.cabinetProviderSettings.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
      include: {
        // Round 6: lets the Cabinet Companies page show/edit which catalog
        // vendor (if any) this company is linked to. Ignored by the plain
        // Settings page's client, which doesn't reference it.
        cabinetVendor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ providers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch cabinet providers" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const {
      actualName,
      displayName,
      contactName,
      contactPhone,
      contactEmail,
      address,
      notes,
      isActive,
      discount,
      factor,
    }: {
      actualName?: string;
      displayName?: string;
      contactName?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      address?: string | null;
      notes?: string | null;
      isActive?: boolean;
      // Round 6, both optional - omitted entirely (not sent at all) falls
      // back to the schema defaults (0 / 1). Only the Cabinet Companies
      // page's form sends these; the plain Settings page's form doesn't,
      // and still works unmodified.
      discount?: number;
      factor?: number;
    } = body;

    if (!actualName?.trim() || !displayName?.trim()) {
      return NextResponse.json(
        { error: "Actual name and display name are required" },
        { status: 400 },
      );
    }

    const created = await prismaAny.cabinetProviderSettings.create({
      data: {
        actualName: actualName.trim(),
        displayName: displayName.trim(),
        contactName: contactName ? contactName.trim() : null,
        contactPhone: contactPhone ? contactPhone.trim() : null,
        contactEmail: contactEmail ? contactEmail.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
        isActive: isActive ?? true,
        ...(discount !== undefined ? { discount } : {}),
        ...(factor !== undefined ? { factor } : {}),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A provider with this actual name already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to create cabinet provider" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const {
      id,
      actualName,
      displayName,
      contactName,
      contactPhone,
      contactEmail,
      address,
      notes,
      isActive,
      discount,
      factor,
    }: {
      id?: string;
      actualName?: string;
      displayName?: string;
      contactName?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      address?: string | null;
      notes?: string | null;
      isActive?: boolean;
      // Round 6, both optional - omitted (the plain Settings page's form
      // never sends these) leaves the stored value untouched rather than
      // resetting it to a default on every save.
      discount?: number;
      factor?: number;
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!actualName?.trim() || !displayName?.trim()) {
      return NextResponse.json(
        { error: "Actual name and display name are required" },
        { status: 400 },
      );
    }

    const updated = await prismaAny.cabinetProviderSettings.update({
      where: { id },
      data: {
        actualName: actualName.trim(),
        displayName: displayName.trim(),
        contactName: contactName ? contactName.trim() : null,
        contactPhone: contactPhone ? contactPhone.trim() : null,
        contactEmail: contactEmail ? contactEmail.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
        isActive: isActive ?? true,
        ...(discount !== undefined ? { discount } : {}),
        ...(factor !== undefined ? { factor } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A provider with this actual name already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to update cabinet provider" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const id = body?.id as string | undefined;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prismaAny.cabinetProviderSettings.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete cabinet provider" },
      { status: 500 },
    );
  }
}
