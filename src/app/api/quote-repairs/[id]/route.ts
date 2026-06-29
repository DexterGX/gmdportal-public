import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { canViewQuoteRepair, canEditQuoteRepair, normalizeQuoteRepairAreas, normalizeQuoteRepairText } from "@/lib/quoteRepairs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();
    if (!user || appRole === "unassigned") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canViewQuoteRepair(appRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const repair = await prisma.quoteRepair.findUnique({
      where: { id },
      include: {
        salesRep: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        currentVersion: { include: { items: { orderBy: { sortOrder: "asc" } }, createdBy: { select: { id: true, name: true, email: true } }, updatedBy: { select: { id: true, name: true, email: true } }, submittedBy: { select: { id: true, name: true, email: true } }, approvedBy: { select: { id: true, name: true, email: true } } } },
        approvedVersion: { include: { items: { orderBy: { sortOrder: "asc" } }, createdBy: { select: { id: true, name: true, email: true } }, updatedBy: { select: { id: true, name: true, email: true } }, submittedBy: { select: { id: true, name: true, email: true } }, approvedBy: { select: { id: true, name: true, email: true } } } },
        versions: { orderBy: { versionNumber: "desc" }, include: { items: { orderBy: { sortOrder: "asc" } }, createdBy: { select: { id: true, name: true, email: true } }, updatedBy: { select: { id: true, name: true, email: true } }, submittedBy: { select: { id: true, name: true, email: true } }, approvedBy: { select: { id: true, name: true, email: true } } } },
        activities: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!repair) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (appRole === "sales" && repair.salesRepId !== user.id && repair.createdById !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(repair);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load quote repair" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();
    if (!user || appRole === "unassigned") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const repair = await prisma.quoteRepair.findUnique({ where: { id }, include: { currentVersion: true } });
    if (!repair) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = repair.createdById === user.id || repair.salesRepId === user.id;
    if (!canEditQuoteRepair(appRole, isOwner)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const areas = body.areas !== undefined ? normalizeQuoteRepairAreas(body.areas) : undefined;

    const updated = await prisma.quoteRepair.update({
      where: { id },
      data: {
        customerName: body.customerName !== undefined ? normalizeQuoteRepairText(body.customerName) : undefined,
        customerPhone: body.customerPhone !== undefined ? normalizeQuoteRepairText(body.customerPhone) || null : undefined,
        propertyAddress: body.propertyAddress !== undefined ? normalizeQuoteRepairText(body.propertyAddress) : undefined,
        pipedrivePersonId: body.pipedrivePersonId !== undefined ? normalizeQuoteRepairText(body.pipedrivePersonId) || null : undefined,
        pipedriveDealId: body.pipedriveDealId !== undefined ? normalizeQuoteRepairText(body.pipedriveDealId) || null : undefined,
        pipedriveDealName: body.pipedriveDealName !== undefined ? normalizeQuoteRepairText(body.pipedriveDealName) || null : undefined,
        contractor: body.contractor !== undefined ? normalizeQuoteRepairText(body.contractor) || null : undefined,
        areas: areas !== undefined ? areas : undefined,
        salesRepId: body.salesRepId && appRole === "admin" ? normalizeQuoteRepairText(body.salesRepId) : undefined,
      },
    });

    await prisma.quoteRepairActivity.create({ data: { quoteRepairId: id, actorUserId: user.id, action: "UPDATED" } });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update quote repair" }, { status: 500 });
  }
}
