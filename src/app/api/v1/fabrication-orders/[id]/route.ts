import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiJson,
  apiNotFound,
  apiServerError,
  authenticateApiKey,
} from "@/lib/apiKeys";
import {
  fabricationOrderInclude,
  serializeFabricationOrder,
} from "@/lib/publicApi/fabricationOrders";

export const dynamic = "force-dynamic";

const prismaAny = prisma as any;

/**
 * GET /api/v1/fabrication-orders/{id}
 * `{id}` can be the order id or its order number (e.g. "FO2609001").
 * Returns the full layout: every piece's dimensions, drawing data and images.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(request, "fabrication-orders:read");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const order = await prismaAny.fabricationOrder.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: fabricationOrderInclude(true),
    });

    if (!order) return apiNotFound("Fabrication order not found");

    return apiJson({
      data: serializeFabricationOrder(order, {
        detail: true,
        includePricing: auth.key.includePricing,
      }),
    });
  } catch (err) {
    return apiServerError(err, "GET fabrication-orders/[id]");
  }
}
