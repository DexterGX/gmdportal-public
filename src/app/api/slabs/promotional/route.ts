import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import postgres from "postgres";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const sql = postgres(connectionString, {
  ssl: "require",
  onnotice: () => {},
});

const ensureTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS "PromotionalSlab" (
      "id" TEXT PRIMARY KEY,
      "slabBaySlabId" TEXT NOT NULL UNIQUE,
      "price" NUMERIC NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
      "soldToClientName" TEXT,
      "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
};

let ensurePromise: Promise<void> | null = null;
const ensureOnce = async () => {
  if (!ensurePromise) {
    ensurePromise = ensureTable().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureOnce();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const types = searchParams.get("types")?.split(",").filter(Boolean) ?? [];
  const brands = searchParams.get("brands")?.split(",").filter(Boolean) ?? [];
  const finishes =
    searchParams.get("finishes")?.split(",").filter(Boolean) ?? [];
  const thicknesses =
    searchParams.get("thicknesses")?.split(",").filter(Boolean) ?? [];
  const statuses =
    searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];

  const rows = await sql`
    SELECT
      ps."id",
      ps."slabBaySlabId",
      ps."price",
      ps."status",
      ps."soldToClientName",
      ps."addedAt",
      ps."updatedAt",
      sb."scannerId",
      sb."name",
      sb."type",
      sb."thickness",
      sb."size",
      sb."clientName",
      sb."brand",
      sb."finish",
      sb."notes",
      sb."jobId",
      sb."rackId",
      sb."batchIndex",
      sb."batchSize"
    FROM "PromotionalSlab" ps
    LEFT JOIN "SlabBaySlab" sb ON sb."id" = ps."slabBaySlabId"
    WHERE sb."type" IN ('GMD', 'REMNANT')
  `;

  let result = rows as Array<Record<string, unknown>>;

  if (search) {
    result = result.filter(
      (r) =>
        String(r.name ?? "")
          .toLowerCase()
          .includes(search) ||
        String(r.slabBaySlabId ?? "")
          .toLowerCase()
          .includes(search) ||
        String(r.brand ?? "")
          .toLowerCase()
          .includes(search),
    );
  }
  if (types.length > 0) {
    result = result.filter((r) => types.includes(String(r.type ?? "")));
  }
  if (brands.length > 0) {
    result = result.filter((r) => brands.includes(String(r.brand ?? "")));
  }
  if (finishes.length > 0) {
    result = result.filter((r) => finishes.includes(String(r.finish ?? "")));
  }
  if (thicknesses.length > 0) {
    result = result.filter((r) =>
      thicknesses.includes(String(r.thickness ?? "")),
    );
  }
  if (statuses.length > 0) {
    result = result.filter((r) => statuses.includes(String(r.status ?? "")));
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureOnce();

  const body = await request.json();
  const { slabBaySlabId, price } = body as {
    slabBaySlabId: string;
    price: number;
  };

  if (!slabBaySlabId || price == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const id = `promo-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const [row] = await sql`
    INSERT INTO "PromotionalSlab" ("id", "slabBaySlabId", "price", "status")
    VALUES (${id}, ${slabBaySlabId}, ${price}, 'AVAILABLE')
    ON CONFLICT ("slabBaySlabId") DO UPDATE
      SET "price" = EXCLUDED."price", "updatedAt" = NOW()
    RETURNING *
  `;

  return NextResponse.json(row, { status: 201 });
}
