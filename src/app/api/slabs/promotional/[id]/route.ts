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

const isOfficeOrAdmin = (role: string) => role === "admin" || role === "office";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureOnce();
  const { user, appRole } = await getCurrentUserWithRole();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    status,
    soldToClientName,
    soldCustomerId,
    soldCustomerName,
    soldJobId,
    soldJobName,
    holdCustomerId,
    holdCustomerName,
    holdJobId,
    holdJobName,
    holdUntil,
    price,
    isPriceTbd,
  } = body as {
    status?: string;
    soldToClientName?: string;
    soldCustomerId?: string;
    soldCustomerName?: string;
    soldJobId?: string;
    soldJobName?: string;
    holdCustomerId?: string;
    holdCustomerName?: string;
    holdJobId?: string;
    holdJobName?: string;
    holdUntil?: string;
    price?: number;
    isPriceTbd?: boolean;
  };

  // Fetch current record
  const [current] = await sql`
    SELECT * FROM "PromotionalSlab" WHERE "id" = ${id}
  `;
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentStatus = String(current.status);
  const newStatus = status ?? currentStatus;
  const nextIsPriceTbd =
    typeof isPriceTbd === "boolean" ? isPriceTbd : Boolean(current.isPriceTbd);
  const parsedPrice =
    typeof price === "number" && Number.isFinite(price) ? price : Number(current.price);
  if (!nextIsPriceTbd && parsedPrice < 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const holdUntilDate = holdUntil ? new Date(holdUntil) : null;
  if (holdUntilDate && Number.isNaN(holdUntilDate.getTime())) {
    return NextResponse.json({ error: "Invalid holdUntil" }, { status: 400 });
  }

  if (currentStatus === "ON_HOLD" && newStatus === "AVAILABLE") {
    const isOwner = current.holdByUserId && String(current.holdByUserId) === user.id;
    if (!isOwner && !isOfficeOrAdmin(appRole)) {
      return NextResponse.json(
        { error: "Only admin, office, or the user who placed the hold can release it" },
        { status: 403 },
      );
    }
  }

  if (newStatus === "ON_HOLD") {
    if (!holdCustomerId || !holdCustomerName || !holdJobId || !holdJobName) {
      return NextResponse.json(
        { error: "On hold requires customer and job" },
        { status: 400 },
      );
    }
  }

  if (newStatus === "SOLD") {
    if (!soldCustomerId || !soldCustomerName || !soldJobId || !soldJobName) {
      return NextResponse.json(
        { error: "Sold requires customer and job" },
        { status: 400 },
      );
    }
  }

  const computedHoldUntil =
    newStatus === "ON_HOLD"
      ? (holdUntilDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).toISOString()
      : null;
  const newSoldTo =
    newStatus === "SOLD"
      ? (soldCustomerName ?? soldToClientName ?? null)
      : null;

  const [updated] = await sql`
    UPDATE "PromotionalSlab"
    SET
      "status" = ${newStatus},
      "price" = ${nextIsPriceTbd ? 0 : parsedPrice},
      "isPriceTbd" = ${nextIsPriceTbd},
      "soldToClientName" = ${newSoldTo},
      "holdUntil" = ${computedHoldUntil},
      "holdByUserId" = ${newStatus === "ON_HOLD" ? user.id : null},
      "holdByUserName" = ${newStatus === "ON_HOLD" ? (user.name ?? user.email ?? "Unknown") : null},
      "holdCustomerId" = ${newStatus === "ON_HOLD" ? holdCustomerId ?? null : null},
      "holdCustomerName" = ${newStatus === "ON_HOLD" ? holdCustomerName ?? null : null},
      "holdJobId" = ${newStatus === "ON_HOLD" ? holdJobId ?? null : null},
      "holdJobName" = ${newStatus === "ON_HOLD" ? holdJobName ?? null : null},
      "soldByUserId" = ${newStatus === "SOLD" ? user.id : null},
      "soldByUserName" = ${newStatus === "SOLD" ? (user.name ?? user.email ?? "Unknown") : null},
      "soldCustomerId" = ${newStatus === "SOLD" ? soldCustomerId ?? null : null},
      "soldCustomerName" = ${newStatus === "SOLD" ? soldCustomerName ?? null : null},
      "soldJobId" = ${newStatus === "SOLD" ? soldJobId ?? null : null},
      "soldJobName" = ${newStatus === "SOLD" ? soldJobName ?? null : null},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING *
  `;

  // Keep slab-level client/job context in sync for downstream programs.
  if (newStatus === "SOLD") {
    await sql`
      UPDATE "SlabBaySlab"
      SET
        "clientName" = ${soldCustomerName ?? soldToClientName ?? ""},
        "jobId" = ${soldJobId ?? null}
      WHERE "id" = ${String(current.slabBaySlabId)}
    `;
  } else if (newStatus === "ON_HOLD") {
    await sql`
      UPDATE "SlabBaySlab"
      SET
        "clientName" = ${holdCustomerName ?? ""},
        "jobId" = ${holdJobId ?? null}
      WHERE "id" = ${String(current.slabBaySlabId)}
    `;
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await sql`DELETE FROM "PromotionalSlab" WHERE "id" = ${id}`;

  return NextResponse.json({ ok: true });
}
