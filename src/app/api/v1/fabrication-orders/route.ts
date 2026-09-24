import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiBadRequest,
  apiJson,
  apiServerError,
  authenticateApiKey,
  parseDateParam,
  parseLimit,
} from "@/lib/apiKeys";
import {
  fabricationOrderInclude,
  serializeFabricationOrder,
} from "@/lib/publicApi/fabricationOrders";

export const dynamic = "force-dynamic";

const prismaAny = prisma as any;

/**
 * GET /api/v1/fabrication-orders
 *
 * Query params (all optional):
 *   updatedSince  ISO date — only orders changed at/after this time (for syncing)
 *   jobNumber     portal job number
 *   jobId         portal job id
 *   dealId        Pipedrive deal id
 *   search        matches client name, order number, or deal name
 *   includeArchived  "true" to include archived orders (default: active only)
 *   limit         page size, default 50, max 200
 *   cursor        value of `nextCursor` from the previous page
 *
 * Results are ordered oldest-updated first so a client can page forward and
 * store the last `updatedAt` it saw as its next `updatedSince`.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request, "fabrication-orders:read");
  if (auth.error) return auth.error;

  try {
    const params = request.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const cursor = params.get("cursor");
    const updatedSince = parseDateParam(params.get("updatedSince"));
    if (updatedSince === null) {
      return apiBadRequest("updatedSince must be an ISO date, e.g. 2026-09-01T00:00:00Z");
    }

    const where: Record<string, unknown> = {};
    if (params.get("includeArchived") !== "true") where.isActive = true;
    if (updatedSince) where.updatedAt = { gte: updatedSince };

    const jobNumberParam = params.get("jobNumber");
    if (jobNumberParam) {
      const jobNumber = Number(jobNumberParam);
      if (!Number.isInteger(jobNumber)) return apiBadRequest("jobNumber must be a whole number");
      where.job = { jobNumber };
    }
    const jobId = params.get("jobId");
    if (jobId) where.jobId = jobId;
    const dealId = params.get("dealId");
    if (dealId) where.dealId = dealId;

    const search = params.get("search")?.trim();
    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: "insensitive" } },
        { orderNumber: { contains: search, mode: "insensitive" } },
        { dealName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      prismaAny.fabricationOrder.count({ where }),
      prismaAny.fabricationOrder.findMany({
        where,
        include: fabricationOrderInclude(false),
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return apiJson({
      data: page.map((order: any) =>
        serializeFabricationOrder(order, {
          detail: false,
          includePricing: auth.key.includePricing,
        }),
      ),
      total,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (err) {
    return apiServerError(err, "GET fabrication-orders");
  }
}
