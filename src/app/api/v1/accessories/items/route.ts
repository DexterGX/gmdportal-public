import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiBadRequest,
  apiJson,
  apiServerError,
  authenticateApiKey,
  num,
  parseDateParam,
  parseLimit,
} from "@/lib/apiKeys";

export const dynamic = "force-dynamic";

const prismaAny = prisma as any;

const STATUSES = [
  "PENDING_REMEASURE_APPROVAL",
  "READY_TO_ORDER",
  "ORDERED",
  "IN_TRANSIT",
  "DELIVERED",
  "CHECKED_IN",
  "INSTALLED",
  "NOT_NEEDED",
  "ISSUE",
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING_REMEASURE_APPROVAL: "Pending Remeasure Approval",
  READY_TO_ORDER: "Ready to Order",
  ORDERED: "Ordered",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  CHECKED_IN: "Checked In",
  INSTALLED: "Installed",
  NOT_NEEDED: "Not Needed",
  ISSUE: "Issue",
};

// The status the team uses for "package is ready to be taken to the jobsite".
// Exposed as `readyForJobsite` so outside programs don't need to know which
// status that is — if the team's convention changes, only this line changes.
const READY_FOR_JOBSITE_STATUS = "DELIVERED";

const DEPARTMENTS = ["CABINETS", "COUNTERTOPS", "BOTH"];

/**
 * GET /api/v1/accessories/items
 *
 * One row per accessory item, with its job and tracker attached.
 *
 * Query params (all optional):
 *   status        one or more statuses, comma-separated (e.g. CHECKED_IN,DELIVERED)
 *   updatedSince  ISO date — only items changed at/after this time
 *   jobNumber     portal job number
 *   jobId         portal job id
 *   trackerId     accessory tracker id
 *   department    CABINETS | COUNTERTOPS | BOTH
 *   includeArchived  "true" to include archived items/trackers
 *   limit         page size, default 50, max 200
 *   cursor        value of `nextCursor` from the previous page
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request, "accessories:read");
  if (auth.error) return auth.error;

  try {
    const params = request.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const cursor = params.get("cursor");
    const includeArchived = params.get("includeArchived") === "true";

    const updatedSince = parseDateParam(params.get("updatedSince"));
    if (updatedSince === null) {
      return apiBadRequest("updatedSince must be an ISO date, e.g. 2026-09-01T00:00:00Z");
    }

    const where: Record<string, unknown> = {};
    const trackerWhere: Record<string, unknown> = {};
    if (!includeArchived) {
      where.isArchived = false;
      trackerWhere.isArchived = false;
    }
    if (updatedSince) where.updatedAt = { gte: updatedSince };

    const statusParam = params.get("status");
    if (statusParam) {
      const requested = statusParam
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      const invalid = requested.filter(
        (value) => !(STATUSES as readonly string[]).includes(value),
      );
      if (invalid.length) {
        return apiBadRequest(
          `Unknown status: ${invalid.join(", ")}. Valid values: ${STATUSES.join(", ")}`,
        );
      }
      where.status = { in: requested };
    }

    const department = params.get("department")?.trim().toUpperCase();
    if (department) {
      if (!DEPARTMENTS.includes(department)) {
        return apiBadRequest(`department must be one of ${DEPARTMENTS.join(", ")}`);
      }
      trackerWhere.department = department;
    }

    const jobNumberParam = params.get("jobNumber");
    if (jobNumberParam) {
      const jobNumber = Number(jobNumberParam);
      if (!Number.isInteger(jobNumber)) return apiBadRequest("jobNumber must be a whole number");
      trackerWhere.job = { jobNumber };
    }
    const jobId = params.get("jobId");
    if (jobId) trackerWhere.jobId = jobId;
    const trackerId = params.get("trackerId");
    if (trackerId) where.trackerId = trackerId;

    if (Object.keys(trackerWhere).length) where.tracker = trackerWhere;

    const [total, rows] = await Promise.all([
      prismaAny.accessoryItem.count({ where }),
      prismaAny.accessoryItem.findMany({
        where,
        include: {
          assignedToUser: { select: { id: true, name: true } },
          tracker: {
            select: {
              id: true,
              invoiceNumber: true,
              department: true,
              notes: true,
              remeasureApprovedAt: true,
              isArchived: true,
              job: {
                select: {
                  id: true,
                  jobNumber: true,
                  jobName: true,
                  status: true,
                  propertyAddress: true,
                  customer: { select: { id: true, displayName: true } },
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const includePricing = auth.key.includePricing;

    return apiJson({
      data: page.map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        sku: item.sku ?? null,
        vendor: item.vendor ?? null,
        status: item.status,
        statusLabel: STATUS_LABELS[item.status] ?? item.status,
        readyForJobsite: item.status === READY_FOR_JOBSITE_STATUS,
        priority: item.priority,
        isArchived: Boolean(item.isArchived),
        assignedTo: item.assignedToUser?.name ?? null,
        dates: {
          ordered: item.orderedAt,
          eta: item.etaAt,
          delivered: item.deliveredAt,
          checkedIn: item.checkedInAt,
          installed: item.installedAt,
          lastStatusChange: item.lastStatusChangedAt,
        },
        ...(includePricing
          ? { pricing: { cost: num(item.cost), retail: num(item.retail) } }
          : {}),
        tracker: {
          id: item.tracker.id,
          invoiceNumber: item.tracker.invoiceNumber ?? null,
          department: item.tracker.department ?? null,
          notes: item.tracker.notes ?? null,
          remeasureApprovedAt: item.tracker.remeasureApprovedAt,
          isArchived: Boolean(item.tracker.isArchived),
        },
        job: item.tracker.job
          ? {
              id: item.tracker.job.id,
              jobNumber: item.tracker.job.jobNumber,
              jobName: item.tracker.job.jobName,
              status: item.tracker.job.status,
              propertyAddress: item.tracker.job.propertyAddress ?? null,
              customer: item.tracker.job.customer?.displayName ?? null,
            }
          : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (err) {
    return apiServerError(err, "GET accessories/items");
  }
}
