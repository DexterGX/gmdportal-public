import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  canViewQuoteRepair,
  formatQuoteRepairNumber,
  normalizeQuoteRepairAreas,
  normalizeQuoteRepairText,
} from "@/lib/quoteRepairs";

type CreatePayload = {
  customerName?: string;
  customerPhone?: string;
  propertyAddress?: string;
  pipedrivePersonId?: string;
  pipedriveDealId?: string;
  pipedriveDealName?: string;
  contractor?: string;
  salesRepId?: string;
  areas?: unknown;
  customerNotes?: string;
  selectedCustomer?: unknown;
  selectedDeal?: unknown;
};

function isUniqueSequenceConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002",
  );
}

export async function GET(request: NextRequest) {
  try {
    const { user, appRole } = await getCurrentUserWithRole();
    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canViewQuoteRepair(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const customer = normalizeQuoteRepairText(searchParams.get("customer"));
    const qr = normalizeQuoteRepairText(searchParams.get("qr"));
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") || 20)),
    );
    const statusFilter = normalizeQuoteRepairText(searchParams.get("status"));
    const salesRepFilter = normalizeQuoteRepairText(
      searchParams.get("salesRep"),
    );
    const requestedStatuses = statusFilter
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const statusIn =
      requestedStatuses.length === 0
        ? undefined
        : Array.from(
            new Set(
              requestedStatuses.flatMap((status) => {
                if (status === "APPROVED") return ["APPROVED"];
                if (status === "DRAFT")
                  return [
                    "DRAFT",
                    "SUBMITTED",
                    "UNDER_REVIEW",
                    "CHANGES_REQUESTED",
                    "VOIDED",
                    "ARCHIVED",
                  ];
                return [status];
              }),
            ),
          );
    const where: Prisma.QuoteRepairWhereInput = {
      deletedAt: null,
      archivedAt: null,
      ...(qr
        ? { quoteRepairNumber: { contains: qr, mode: "insensitive" } }
        : {}),
      ...(customer
        ? { customerName: { contains: customer, mode: "insensitive" } }
        : {}),
      ...(statusIn ? { status: { in: statusIn as any } } : {}),
      ...(salesRepFilter
        ? {
            salesRep: {
              OR: [
                { id: { in: salesRepFilter.split(",").filter(Boolean) } },
                { name: { in: salesRepFilter.split(",").filter(Boolean) } },
                { email: { in: salesRepFilter.split(",").filter(Boolean) } },
              ],
            },
          }
        : {}),
    };

    const [total, repairs] = await Promise.all([
      prisma.quoteRepair.count({ where }),
      prisma.quoteRepair.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          quoteRepairNumber: true,
          customerName: true,
          propertyAddress: true,
          status: true,
          areas: true,
          createdAt: true,
          updatedAt: true,
          salesRep: { select: { id: true, name: true, email: true } },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 2,
            select: {
              id: true,
              versionNumber: true,
              status: true,
              total: true,
            },
          },
          currentVersion: {
            select: { id: true, versionNumber: true, total: true },
          },
          approvedVersion: {
            select: { id: true, versionNumber: true, total: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      rows: repairs.map((repair) => ({
        id: repair.id,
        quoteRepairNumber: repair.quoteRepairNumber,
        customerName: repair.customerName,
        propertyAddress: repair.propertyAddress,
        status: repair.status,
        currentVersionNumber:
          repair.currentVersion?.versionNumber ??
          repair.versions[0]?.versionNumber ??
          null,
        approvedVersionNumber: repair.approvedVersion?.versionNumber ?? null,
        total: String(
          repair.currentVersion?.total ?? repair.versions[0]?.total ?? "0",
        ),
        createdAt: repair.createdAt.toISOString(),
        updatedAt: repair.updatedAt.toISOString(),
        salesRep: repair.salesRep,
        areas: Array.isArray(repair.areas) ? repair.areas : [],
        versions: repair.versions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNumber,
          status: version.status,
          total: String(version.total),
        })),
      })),
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load quote repairs" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, appRole } = await getCurrentUserWithRole();
    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["admin", "sales"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as CreatePayload;
    const customerName = normalizeQuoteRepairText(body.customerName);
    const propertyAddress = normalizeQuoteRepairText(body.propertyAddress);
    const salesRepId = normalizeQuoteRepairText(body.salesRepId) || user.id;
    const areas = normalizeQuoteRepairAreas(body.areas);

    if (!customerName || !propertyAddress || areas.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const selectedCustomer = (body.selectedCustomer ?? {}) as Record<
      string,
      any
    >;
    const selectedDeal = (body.selectedDeal ?? {}) as Record<string, any>;
    const customerPhone =
      normalizeQuoteRepairText(body.customerPhone) ||
      normalizeQuoteRepairText(selectedCustomer.phone);
    const pipedrivePersonId =
      normalizeQuoteRepairText(body.pipedrivePersonId) ||
      normalizeQuoteRepairText(selectedCustomer.pipedriveId);
    const pipedriveDealId =
      normalizeQuoteRepairText(body.pipedriveDealId) ||
      normalizeQuoteRepairText(selectedDeal.dealId);
    const pipedriveDealName =
      normalizeQuoteRepairText(body.pipedriveDealName) ||
      normalizeQuoteRepairText(selectedDeal.dealName);
    const contractor =
      normalizeQuoteRepairText(body.contractor) ||
      normalizeQuoteRepairText(selectedCustomer.contractor);
    let repairId = "";
    const created = await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        let sequenceRow = await tx.quoteRepairSequence.findUnique({
          where: {
            year_month: { year: now.getFullYear(), month: now.getMonth() + 1 },
          },
        });
        if (!sequenceRow) {
          sequenceRow = await tx.quoteRepairSequence.create({
            data: {
              year: now.getFullYear(),
              month: now.getMonth() + 1,
              lastNumber: 1,
            },
          });
        } else {
          sequenceRow = await tx.quoteRepairSequence.update({
            where: {
              year_month: {
                year: now.getFullYear(),
                month: now.getMonth() + 1,
              },
            },
            data: { lastNumber: { increment: 1 } },
          });
        }

        const quoteRepairNumber = formatQuoteRepairNumber(
          now,
          sequenceRow.lastNumber,
        );
        const repair = await tx.quoteRepair.create({
          data: {
            quoteRepairNumber,
            customerName,
            customerPhone: customerPhone || null,
            propertyAddress,
            pipedrivePersonId: pipedrivePersonId || null,
            pipedriveDealId: pipedriveDealId || null,
            pipedriveDealName: pipedriveDealName || null,
            contractor: contractor || null,
            areas,
            salesRepId,
            createdById: user.id,
            status: "DRAFT",
            nextVersionNumber: 1,
          },
          select: { id: true },
        });

        repairId = repair.id;
        await tx.quoteRepairActivity.create({
          data: {
            quoteRepairId: repair.id,
            actorUserId: user.id,
            action: "CREATED",
            afterSummary: quoteRepairNumber,
          },
        });

        return repair;
      },
      { maxWait: 5000, timeout: 15000 },
    );

    return NextResponse.json({ id: repairId || created.id }, { status: 201 });
  } catch (error: any) {
    if (isUniqueSequenceConflict(error)) {
      return NextResponse.json(
        { error: "Quote repair number conflict. Please retry." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to create quote repair" },
      { status: 500 },
    );
  }
}
