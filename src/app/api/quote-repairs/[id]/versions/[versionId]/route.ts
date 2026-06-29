import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  canEditQuoteRepair,
  isQuoteRepairItemMeaningful,
  normalizeQuoteRepairText,
  toCurrencyDecimal,
} from "@/lib/quoteRepairs";

type UpdateVersionItem = {
  serviceId?: string | null;
  serviceNameSnapshot?: string;
  description?: string;
  price?: string | number | null;
};

type UpdateVersionPayload = {
  customerNotes?: string;
  internalNotes?: string;
  items?: UpdateVersionItem[];
};

function toOptionalDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const numberValue = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return new Prisma.Decimal(numberValue.toFixed(2));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const { id, versionId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();
    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repair = await prisma.quoteRepair.findUnique({ where: { id } });
    if (!repair) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner =
      repair.createdById === user.id || repair.salesRepId === user.id;
    if (!canEditQuoteRepair(appRole, isOwner)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (repair.currentVersionId !== versionId) {
      return NextResponse.json(
        { error: "Only current version can be edited" },
        { status: 400 },
      );
    }

    const version = await prisma.quoteRepairVersion.findFirst({
      where: {
        id: versionId,
        quoteRepairId: id,
      },
      include: {
        items: true,
      },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    if (version.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft versions can be edited" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as UpdateVersionPayload;
    const requestedItems = Array.isArray(body.items) ? body.items : [];
    const providedServiceIds = Array.from(
      new Set(
        requestedItems
          .map((item) => normalizeQuoteRepairText(item.serviceId))
          .filter(Boolean),
      ),
    );

    const services =
      providedServiceIds.length > 0
        ? await prisma.quoteRepairService.findMany({
            where: { id: { in: providedServiceIds } },
          })
        : [];
    const serviceMap = new Map(
      services.map((service) => [service.id, service]),
    );

    const meaningfulRows = requestedItems
      .map((item) => {
        const serviceId = normalizeQuoteRepairText(item.serviceId) || null;
        const selectedService = serviceId ? serviceMap.get(serviceId) : null;
        const serviceNameSnapshot =
          selectedService?.name ||
          normalizeQuoteRepairText(item.serviceNameSnapshot);
        const description = normalizeQuoteRepairText(item.description);
        const price = toOptionalDecimal(item.price);

        if (
          !isQuoteRepairItemMeaningful({
            serviceNameSnapshot,
            description,
            price,
          })
        ) {
          return null;
        }

        return {
          serviceId,
          serviceNameSnapshot,
          description,
          price,
        };
      })
      .filter(
        (
          item,
        ): item is {
          serviceId: string | null;
          serviceNameSnapshot: string;
          description: string;
          price: Prisma.Decimal | null;
        } => Boolean(item),
      );

    const total = meaningfulRows.reduce(
      (sum, row) => sum + Number(row.price || 0),
      0,
    );

    await prisma.$transaction(async (tx) => {
      await tx.quoteRepairItem.deleteMany({
        where: { quoteRepairVersionId: versionId },
      });

      if (meaningfulRows.length > 0) {
        await tx.quoteRepairItem.createMany({
          data: meaningfulRows.map((row, index) => ({
            quoteRepairVersionId: versionId,
            sortOrder: index + 1,
            serviceId: row.serviceId,
            serviceNameSnapshot: row.serviceNameSnapshot,
            description: row.description,
            price: row.price,
          })),
        });
      }

      await tx.quoteRepairVersion.update({
        where: { id: versionId },
        data: {
          customerNotes:
            body.customerNotes !== undefined
              ? normalizeQuoteRepairText(body.customerNotes) || null
              : undefined,
          internalNotes:
            body.internalNotes !== undefined
              ? normalizeQuoteRepairText(body.internalNotes) || null
              : undefined,
          updatedById: user.id,
          total: toCurrencyDecimal(total),
        },
      });

      await tx.quoteRepairActivity.create({
        data: {
          quoteRepairId: id,
          quoteRepairVersionId: versionId,
          actorUserId: user.id,
          action: "UPDATED_VERSION",
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save version" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const { id, versionId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();
    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const repair = await prisma.quoteRepair.findUnique({
      where: { id },
      include: {
        versions: {
          where: { deletedAt: null },
          orderBy: { versionNumber: "desc" },
          select: { id: true, versionNumber: true, status: true },
        },
      },
    });

    if (!repair) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const target = repair.versions.find((version) => version.id === versionId);
    if (!target) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const remaining = repair.versions.filter(
      (version) => version.id !== versionId,
    );
    const nextCurrent = remaining[0] || null;
    const nextApproved =
      remaining.find((version) => version.status === "APPROVED") || null;

    await prisma.$transaction(async (tx) => {
      await tx.quoteRepairVersion.update({
        where: { id: versionId },
        data: { deletedAt: new Date() },
      });

      await tx.quoteRepair.update({
        where: { id },
        data: {
          currentVersionId: nextCurrent?.id || null,
          approvedVersionId: nextApproved?.id || null,
          status: nextApproved ? "APPROVED" : "DRAFT",
        },
      });

      await tx.quoteRepairActivity.create({
        data: {
          quoteRepairId: id,
          quoteRepairVersionId: versionId,
          actorUserId: user.id,
          action: "DELETED_VERSION",
          afterSummary: `Version ${target.versionNumber}`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete version" },
      { status: 500 },
    );
  }
}
