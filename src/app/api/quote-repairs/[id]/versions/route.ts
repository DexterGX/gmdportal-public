import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { canEditQuoteRepair, toCurrencyDecimal } from "@/lib/quoteRepairs";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { user, appRole, appRoles } = await getProgramUserContext("quoteRepairs");
    if (!user || appRoles.length === 0) {
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

    const isOwner =
      repair.createdById === user.id || repair.salesRepId === user.id;
    if (!canEditQuoteRepair(appRole, isOwner)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const sourceVersionId = normalizeText(body?.sourceVersionId);

    const nextVersionNumber = repair.nextVersionNumber;
    const sourceVersion = sourceVersionId
      ? await prisma.quoteRepairVersion.findFirst({
          where: { id: sourceVersionId, quoteRepairId: id, deletedAt: null },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        })
      : repair.currentVersion;
    const sourceItems = sourceVersion?.items ?? [];

    const created = await prisma.$transaction(async (tx) => {
      const version = await tx.quoteRepairVersion.create({
        data: {
          quoteRepairId: id,
          versionNumber: nextVersionNumber,
          status: "DRAFT",
          customerNotes: sourceVersion?.customerNotes || null,
          internalNotes: sourceVersion?.internalNotes || null,
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

        const nextTotal = sourceItems.reduce(
          (sum, item) => sum + Number(item.price || 0),
          0,
        );
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
          details: sourceVersionId ? { sourceVersionId } : undefined,
        },
      });

      return version;
    });

    return NextResponse.json(
      {
        id: created.id,
        versionNumber: created.versionNumber,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create version" },
      { status: 500 },
    );
  }
}
