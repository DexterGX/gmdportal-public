import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import postgres from "postgres";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const sql = postgres(connectionString, {
  ssl: "require",
  onnotice: () => {},
});

/**
 * GET /api/slabs/promotional/bay-slabs
 * Returns GMD and REMNANT slabs from SlabBaySlab (for admin picker).
 * Query params: q (search), includePromoted (default false)
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appRole } = await getProgramUserContext("slabs");
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const includePromoted = searchParams.get("includePromoted") === "true";
  const grouped = searchParams.get("grouped") === "true";

  if (grouped) {
    const [available, alreadyAdded] = await Promise.all([
      sql`
        SELECT sb.*
        FROM "SlabBaySlab" sb
        WHERE sb."type" IN ('GMD', 'REMNANT')
          AND sb."id" NOT IN (
            SELECT "slabBaySlabId" FROM "PromotionalSlab"
          )
        ORDER BY sb."name" ASC
      `,
      sql`
        SELECT
          ps."id" AS "promoId",
          ps."slabBaySlabId",
          ps."price",
          ps."isPriceTbd",
          ps."status",
          sb.*
        FROM "PromotionalSlab" ps
        LEFT JOIN "SlabBaySlab" sb ON sb."id" = ps."slabBaySlabId"
        WHERE sb."type" IN ('GMD', 'REMNANT')
        ORDER BY sb."name" ASC
      `,
    ]);

    let availableRows = available as Array<Record<string, unknown>>;
    let alreadyRows = alreadyAdded as Array<Record<string, unknown>>;

    if (q) {
      const bySearch = (row: Record<string, unknown>) =>
        String(row.name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(row.id ?? row.slabBaySlabId ?? "")
          .toLowerCase()
          .includes(q) ||
        String(row.brand ?? "")
          .toLowerCase()
          .includes(q);
      availableRows = availableRows.filter(bySearch);
      alreadyRows = alreadyRows.filter(bySearch);
    }

    return NextResponse.json({
      available: availableRows,
      alreadyAdded: alreadyRows.map((row) => ({
        ...row,
        price: Number(row.price ?? 0),
        isPriceTbd: Boolean(row.isPriceTbd),
      })),
    });
  }

  let rows;
  if (includePromoted) {
    rows = await sql`
      SELECT sb.*
      FROM "SlabBaySlab" sb
      WHERE sb."type" IN ('GMD', 'REMNANT')
      ORDER BY sb."name" ASC
    `;
  } else {
    rows = await sql`
      SELECT sb.*
      FROM "SlabBaySlab" sb
      WHERE sb."type" IN ('GMD', 'REMNANT')
        AND sb."id" NOT IN (
          SELECT "slabBaySlabId" FROM "PromotionalSlab"
        )
      ORDER BY sb."name" ASC
    `;
  }

  let result = rows as Array<Record<string, unknown>>;

  if (q) {
    result = result.filter(
      (r) =>
        String(r.name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(r.id ?? "")
          .toLowerCase()
          .includes(q) ||
        String(r.brand ?? "")
          .toLowerCase()
          .includes(q),
    );
  }

  return NextResponse.json(result);
}
