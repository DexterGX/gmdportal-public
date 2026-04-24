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

type CreatePromoEntry = {
  slabBaySlabId: string;
  price?: number;
  isPriceTbd?: boolean;
};

type SlabTypeRow = {
  id: string;
  type: string;
};

const isOfficeOrAdmin = (role: string) => role === "admin" || role === "office";

const ensureTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS "PromotionalSlab" (
      "id" TEXT PRIMARY KEY,
      "slabBaySlabId" TEXT NOT NULL UNIQUE,
      "price" NUMERIC NOT NULL DEFAULT 0,
      "isPriceTbd" BOOLEAN NOT NULL DEFAULT FALSE,
      "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
      "soldToClientName" TEXT,
      "holdUntil" TIMESTAMPTZ,
      "holdByUserId" TEXT,
      "holdByUserName" TEXT,
      "holdCustomerId" TEXT,
      "holdCustomerName" TEXT,
      "holdJobId" TEXT,
      "holdJobName" TEXT,
      "soldByUserId" TEXT,
      "soldByUserName" TEXT,
      "soldCustomerId" TEXT,
      "soldCustomerName" TEXT,
      "soldJobId" TEXT,
      "soldJobName" TEXT,
      "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE "PromotionalSlab"
    ADD COLUMN IF NOT EXISTS "isPriceTbd" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "holdUntil" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "holdByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "holdByUserName" TEXT,
    ADD COLUMN IF NOT EXISTS "holdCustomerId" TEXT,
    ADD COLUMN IF NOT EXISTS "holdCustomerName" TEXT,
    ADD COLUMN IF NOT EXISTS "holdJobId" TEXT,
    ADD COLUMN IF NOT EXISTS "holdJobName" TEXT,
    ADD COLUMN IF NOT EXISTS "soldByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "soldByUserName" TEXT,
    ADD COLUMN IF NOT EXISTS "soldCustomerId" TEXT,
    ADD COLUMN IF NOT EXISTS "soldCustomerName" TEXT,
    ADD COLUMN IF NOT EXISTS "soldJobId" TEXT,
    ADD COLUMN IF NOT EXISTS "soldJobName" TEXT
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
  const { user, appRole } = await getCurrentUserWithRole();

  await sql`
    UPDATE "PromotionalSlab"
    SET
      "status" = 'AVAILABLE',
      "holdUntil" = NULL,
      "holdByUserId" = NULL,
      "holdByUserName" = NULL,
      "holdCustomerId" = NULL,
      "holdCustomerName" = NULL,
      "holdJobId" = NULL,
      "holdJobName" = NULL,
      "updatedAt" = NOW()
    WHERE "status" = 'ON_HOLD' AND "holdUntil" IS NOT NULL AND "holdUntil" <= NOW()
  `;

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
      ps."isPriceTbd",
      ps."status",
      ps."soldToClientName",
      ps."holdUntil",
      ps."holdByUserId",
      ps."holdByUserName",
      ps."holdCustomerId",
      ps."holdCustomerName",
      ps."holdJobId",
      ps."holdJobName",
      ps."soldByUserId",
      ps."soldByUserName",
      ps."soldCustomerId",
      ps."soldCustomerName",
      ps."soldJobId",
      ps."soldJobName",
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

  const payload = result.map((row) => {
    const status = String(row.status ?? "AVAILABLE");
    const holdByUserId = row.holdByUserId ? String(row.holdByUserId) : null;
    const canReleaseHold =
      status !== "ON_HOLD" ||
      Boolean(user && holdByUserId && user.id === holdByUserId) ||
      isOfficeOrAdmin(appRole);

    return {
      ...row,
      price: Number(row.price ?? 0),
      isPriceTbd: Boolean(row.isPriceTbd),
      canReleaseHold,
    };
  });

  return NextResponse.json(payload);
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
  const entries: CreatePromoEntry[] = Array.isArray(body?.entries)
    ? (body.entries as CreatePromoEntry[])
    : [
        {
          slabBaySlabId: String(body?.slabBaySlabId ?? ""),
          price: body?.price,
          isPriceTbd: Boolean(body?.isPriceTbd),
        },
      ];

  if (!entries.length) {
    return NextResponse.json({ error: "No slabs provided" }, { status: 400 });
  }

  const normalized = entries.map((entry) => {
    const slabBaySlabId = String(entry.slabBaySlabId ?? "").trim();
    const isPriceTbd = Boolean(entry.isPriceTbd);
    const price =
      typeof entry.price === "number" && Number.isFinite(entry.price)
        ? entry.price
        : null;
    return { slabBaySlabId, isPriceTbd, price };
  });

  for (const entry of normalized) {
    if (!entry.slabBaySlabId) {
      return NextResponse.json(
        { error: "Each slab requires slabBaySlabId" },
        { status: 400 },
      );
    }
    if (!entry.isPriceTbd && (entry.price == null || entry.price < 0)) {
      return NextResponse.json(
        {
          error:
            "Each slab must include a valid non-negative price or be marked as TBD",
        },
        { status: 400 },
      );
    }
  }

  const slabIds = normalized.map((entry) => entry.slabBaySlabId);
  const slabRows = await sql<SlabTypeRow[]>`
    SELECT "id", "type"
    FROM "SlabBaySlab"
    WHERE "id" IN ${sql(slabIds)}
  `;
  const slabTypeById = new Map(
    slabRows.map((row) => [
      row.id,
      row.type,
    ]),
  );

  for (const entry of normalized) {
    const slabType = slabTypeById.get(entry.slabBaySlabId);
    if (!slabType || !["GMD", "REMNANT"].includes(slabType)) {
      return NextResponse.json(
        {
          error: `Slab ${entry.slabBaySlabId} must exist in Slab Bay and be GMD/REMNANT`,
        },
        { status: 400 },
      );
    }
  }

  const created = await sql.begin(async (tx) => {
    const rows: Array<Record<string, unknown>> = [];
    for (const entry of normalized) {
      const id = `promo-${crypto.randomUUID()}`;
      const priceValue = entry.isPriceTbd ? 0 : (entry.price ?? 0);
      const [row] = await tx`
        INSERT INTO "PromotionalSlab" (
          "id",
          "slabBaySlabId",
          "price",
          "isPriceTbd",
          "status"
        )
        VALUES (${id}, ${entry.slabBaySlabId}, ${priceValue}, ${entry.isPriceTbd}, 'AVAILABLE')
        ON CONFLICT ("slabBaySlabId") DO UPDATE
          SET
            "price" = EXCLUDED."price",
            "isPriceTbd" = EXCLUDED."isPriceTbd",
            "updatedAt" = NOW()
        RETURNING *
      `;
      rows.push(row as Record<string, unknown>);
    }
    return rows;
  });

  return NextResponse.json(
    {
      count: created.length,
      rows: created,
    },
    { status: 201 },
  );
}
