import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { canEditQuoteRepair, toCurrencyDecimal } from "@/lib/quoteRepairs";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();
    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repair = await prisma.quoteRepair.findUnique({
      where: { id },
      include: {
        currentVersion: {
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!repair) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = repair.createdById === user.id || repair.salesRepId === user.id;
    if (!canEditQuoteRepair(appRole, isOwner)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextVersionNumber = repair.nextVersionNumber;
    const sourceItems = repair.currentVersion?.items ?? [];

    const created = await prisma.$transaction(async (tx) => {
      const version = await tx.quoteRepairVersion.create({
        data: {
          quoteRepairId: id,
          versionNumber: nextVersionNumber,
          status: "DRAFT",
          customerNotes: repair.currentVersion?.customerNotes || null,
          internalNotes: repair.currentVersion?.internalNotes || null,
          createdById: user.id,
          total: toCurrencyDecimal(0),
        },
      });

      if (sourceItems.length > 0) {
        await tx.quoteRepairItem.createMany({
          data: sourceItems.map((item) => ({
            quoteRepairVersionId: version.id,
            sortOrder: item.sortOrder,
            serviceId: item.serviceId,
            serviceNameSnapshot: item.serviceNameSnapshot,
            description: item.description,
            price: item.price,
            internalNote: item.internalNote,
          })),
        });

        const nextTotal = sourceItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
        await tx.quoteRepairVersion.update({
          where: { id: version.id },
          data: { total: toCurrencyDecimal(nextTotal) },
        });
      }

      await tx.quoteRepair.update({
        where: { id },
        data: {
          currentVersionId: version.id,
          nextVersionNumber: { increment: 1 },
          status: "DRAFT",
        },
      });

      await tx.quoteRepairActivity.create({
        data: {
          quoteRepairId: id,
          quoteRepairVersionId: version.id,
          actorUserId: user.id,
          action: "CREATED_VERSION",
          afterSummary: `Version ${nextVersionNumber}`,
        },
      });

      return version;
    });

    return NextResponse.json({
      id: created.id,
      versionNumber: created.versionNumber,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create version" }, { status: 500 });
  }
}
