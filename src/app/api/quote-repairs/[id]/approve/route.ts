import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  isQuoteRepairItemMeaningful,
  normalizeQuoteRepairText,
  toCurrencyDecimal,
  canEditQuoteRepair,
} from "@/lib/quoteRepairs";

type ApproveItem = {
  serviceId?: string | null;
  serviceNameSnapshot?: string;
  description?: string;
  price?: string | number | null;
};

type ApprovePayload = {
  customerNotes?: string;
  internalNotes?: string;
  items?: ApproveItem[];
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || appRole !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const repair = await prisma.quoteRepair.findUnique({
    where: { id },
    include: { currentVersion: { include: { items: true } } },
  });
  if (!repair?.currentVersion)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const currentVersionId = repair.currentVersion.id;

  const body = (await request.json().catch(() => ({}))) as ApprovePayload;
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
  const serviceMap = new Map(services.map((service) => [service.id, service]));

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

      return { serviceId, serviceNameSnapshot, description, price };
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

  const approvedAt = new Date();
  await prisma.$transaction(async (tx) => {
    if (
      meaningfulRows.length > 0 ||
      body.customerNotes !== undefined ||
      body.internalNotes !== undefined
    ) {
      await tx.quoteRepairItem.deleteMany({
        where: { quoteRepairVersionId: currentVersionId },
      });

      if (meaningfulRows.length > 0) {
        await tx.quoteRepairItem.createMany({
          data: meaningfulRows.map((row, index) => ({
            quoteRepairVersionId: currentVersionId,
            sortOrder: index + 1,
            serviceId: row.serviceId,
            serviceNameSnapshot: row.serviceNameSnapshot,
            description: row.description,
            price: row.price,
          })),
        });
      }

      await tx.quoteRepairVersion.update({
        where: { id: currentVersionId },
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
    }

    await tx.quoteRepairVersion.update({
      where: { id: currentVersionId },
      data: { status: "APPROVED", approvedById: user.id, approvedAt },
    });
    await tx.quoteRepair.update({
      where: { id },
      data: { status: "APPROVED", approvedVersionId: currentVersionId },
    });
    await tx.quoteRepairActivity.create({
      data: {
        quoteRepairId: id,
        quoteRepairVersionId: currentVersionId,
        actorUserId: user.id,
        action: "APPROVED",
      },
    });
  });

  return NextResponse.json({ ok: true });
}
