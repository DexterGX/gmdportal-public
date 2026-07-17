import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import postgres from "postgres";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import type { CreateSlabDeliveryExpectationInput } from "@/app/slab-rack-display/ui/expectedDeliveries";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const sql = postgres(connectionString, {
  ssl: "require",
  onnotice: () => {
    // Ignore IF NOT EXISTS notices in development logs.
  },
});

let ensureTablePromise: Promise<void> | null = null;

const ensureTableOnce = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = ensureTable().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }
  await ensureTablePromise;
};

const ensureTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS "SlabBayExpectedDelivery" (
      "id" TEXT PRIMARY KEY,
      "clientName" TEXT NOT NULL,
      "originalClientName" TEXT,
      "slabName" TEXT NOT NULL,
      "brand" TEXT NOT NULL,
      "thickness" TEXT NOT NULL,
      "finish" TEXT,
      "quantity" INTEGER NOT NULL,
      "slabType" TEXT NOT NULL,
      "jobId" TEXT,
      "notes" TEXT,
      "extraNotesJson" TEXT NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdBy" TEXT NOT NULL
    );
  `;
};

const parseExtraNotes = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return [] as string[];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((note): note is string => typeof note === "string");
  } catch {
    return [];
  }
};

const buildId = () =>
  `expected-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json([], { status: 401 });
  }

  await ensureTableOnce();

  const rows = (await sql`
    SELECT *
    FROM "SlabBayExpectedDelivery"
    ORDER BY "createdAt" DESC
  `) as Array<Record<string, unknown>>;

  return NextResponse.json(
    rows.map((row) => ({
      id: String(row.id ?? ""),
      clientName: String(row.clientName ?? ""),
      originalClientName: row.originalClientName
        ? String(row.originalClientName)
        : undefined,
      slabName: String(row.slabName ?? ""),
      brand: String(row.brand ?? ""),
      thickness: String(row.thickness ?? ""),
      finish: row.finish ? String(row.finish) : undefined,
      quantity: Number(row.quantity ?? 1),
      slabType: String(row.slabType ?? "SLAB"),
      jobId: row.jobId ? String(row.jobId) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      extraNotes: parseExtraNotes(row.extraNotesJson),
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(
              String(row.createdAt ?? new Date().toISOString()),
            ).toISOString(),
      createdBy: String(row.createdBy ?? "Unknown User"),
    })),
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin" && appRole !== "office") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body =
    (await request.json()) as Partial<CreateSlabDeliveryExpectationInput>;
  const quantity = Number(body.quantity ?? 0);
  const extraNotes = Array.isArray(body.extraNotes)
    ? body.extraNotes.filter((note): note is string => typeof note === "string")
    : [];

  if (
    !body.clientName?.trim() ||
    !body.slabName?.trim() ||
    !body.brand?.trim() ||
    !body.thickness?.trim() ||
    !body.slabType?.trim() ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      { error: "Missing required expected delivery fields." },
      { status: 400 },
    );
  }

  if (body.slabType === "GMD" && !body.originalClientName?.trim()) {
    return NextResponse.json(
      { error: "Original client is required for GMD slabs." },
      { status: 400 },
    );
  }

  await ensureTableOnce();

  const createdBy = session.user.name || session.user.email || "Unknown User";
  const created = {
    id: buildId(),
    clientName: body.clientName.trim(),
    originalClientName: body.originalClientName?.trim() || null,
    slabName: body.slabName.trim(),
    brand: body.brand.trim(),
    thickness: body.thickness.trim(),
    finish: body.finish?.trim() || null,
    quantity,
    slabType: body.slabType.trim(),
    jobId: body.jobId?.trim() || null,
    notes: body.notes?.trim() || null,
    extraNotesJson: JSON.stringify(extraNotes.map((note) => note.trim())),
    createdBy,
  };

  await sql`
    INSERT INTO "SlabBayExpectedDelivery"
    ${sql(
      [created],
      "id",
      "clientName",
      "originalClientName",
      "slabName",
      "brand",
      "thickness",
      "finish",
      "quantity",
      "slabType",
      "jobId",
      "notes",
      "extraNotesJson",
      "createdBy",
    )}
  `;

  return NextResponse.json({
    id: created.id,
    clientName: created.clientName,
    originalClientName: created.originalClientName ?? undefined,
    slabName: created.slabName,
    brand: created.brand,
    thickness: created.thickness,
    finish: created.finish ?? undefined,
    quantity: created.quantity,
    slabType: created.slabType,
    jobId: created.jobId ?? undefined,
    notes: created.notes ?? undefined,
    extraNotes,
    createdAt: new Date().toISOString(),
    createdBy,
  });
}
