import { NextResponse } from "next/server";
import postgres from "postgres";
import type { SlabBayState } from "@/app/slab-rack-display/ui/mockData";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const sql = postgres(connectionString, {
  ssl: "require",
  onnotice: () => {
    // Suppress noisy IF NOT EXISTS notices from Postgres.
  },
});

let ensureTablesPromise: Promise<void> | null = null;

const ensureTablesOnce = async () => {
  if (!ensureTablesPromise) {
    ensureTablesPromise = ensureTables().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }
  await ensureTablesPromise;
};

const ensureTables = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS "SlabBayStateMeta" (
      "id" INTEGER PRIMARY KEY,
      "version" INTEGER NOT NULL
    );
  `;
  await sql`
    INSERT INTO "SlabBayStateMeta" ("id", "version")
    VALUES (1, 1)
    ON CONFLICT ("id") DO NOTHING;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "SlabBayRack" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "capacity" INTEGER NOT NULL,
      "note" TEXT,
      "countTowardInventory" BOOLEAN NOT NULL DEFAULT TRUE,
      "targetFill" INTEGER NOT NULL DEFAULT 5
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "SlabBaySlab" (
      "id" TEXT PRIMARY KEY,
      "scannerId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "thickness" TEXT NOT NULL,
      "size" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "brand" TEXT,
      "finish" TEXT,
      "notes" TEXT,
      "jobId" TEXT,
      "rackId" TEXT NOT NULL REFERENCES "SlabBayRack"("id") ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "batchId" TEXT,
      "batchIndex" INTEGER,
      "batchSize" INTEGER
    );
  `;
  await sql`
    ALTER TABLE "SlabBaySlab"
      ADD COLUMN IF NOT EXISTS "brand" TEXT,
      ADD COLUMN IF NOT EXISTS "finish" TEXT,
      ADD COLUMN IF NOT EXISTS "notes" TEXT,
      ADD COLUMN IF NOT EXISTS "jobId" TEXT,
      ADD COLUMN IF NOT EXISTS "batchId" TEXT,
      ADD COLUMN IF NOT EXISTS "batchIndex" INTEGER,
      ADD COLUMN IF NOT EXISTS "batchSize" INTEGER;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "SlabBayHistory" (
      "id" TEXT PRIMARY KEY,
      "type" TEXT NOT NULL,
      "slabId" TEXT NOT NULL,
      "slabScannerId" TEXT,
      "slabName" TEXT NOT NULL,
      "slabType" TEXT NOT NULL,
      "slabThickness" TEXT,
      "slabSize" TEXT,
      "slabNotes" TEXT,
      "slabCreatedAt" TEXT,
      "clientName" TEXT NOT NULL,
      "brand" TEXT,
      "finish" TEXT,
      "jobId" TEXT,
      "entryNote" TEXT,
      "fromRack" TEXT,
      "toRack" TEXT,
      "exitNote" TEXT,
      "batchId" TEXT,
      "batchIndex" INTEGER,
      "batchSize" INTEGER,
      "recoveredFromHistoryId" TEXT,
      "userName" TEXT NOT NULL,
      "timestamp" TEXT NOT NULL
    );
  `;
  await sql`
    ALTER TABLE "SlabBayHistory"
      ADD COLUMN IF NOT EXISTS "slabThickness" TEXT,
      ADD COLUMN IF NOT EXISTS "slabSize" TEXT,
      ADD COLUMN IF NOT EXISTS "slabNotes" TEXT,
      ADD COLUMN IF NOT EXISTS "slabCreatedAt" TEXT,
      ADD COLUMN IF NOT EXISTS "brand" TEXT,
      ADD COLUMN IF NOT EXISTS "finish" TEXT,
      ADD COLUMN IF NOT EXISTS "jobId" TEXT,
      ADD COLUMN IF NOT EXISTS "entryNote" TEXT,
      ADD COLUMN IF NOT EXISTS "batchId" TEXT,
      ADD COLUMN IF NOT EXISTS "batchIndex" INTEGER,
      ADD COLUMN IF NOT EXISTS "batchSize" INTEGER,
      ADD COLUMN IF NOT EXISTS "recoveredFromHistoryId" TEXT;
  `;
};

const getCurrentVersion = async (db: typeof sql): Promise<number> => {
  const rows = (await db`
    SELECT "version"
    FROM "SlabBayStateMeta"
    WHERE "id" = 1
    LIMIT 1
  `) as Array<{ version: number }>;

  return rows[0]?.version ?? 1;
};

const buildDefaultRacks = () => {
  const buildRange = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => {
      const name = `${prefix}${index + 1}`;
      return {
        id: name.toLowerCase(),
        name,
        capacity: 7,
        note: null as string | null,
        countTowardInventory: true,
        targetFill: 5,
      };
    });

  return [
    ...buildRange("A", 30),
    ...buildRange("B", 3),
    {
      id: "c1",
      name: "C1",
      capacity: 7,
      note: null,
      countTowardInventory: true,
      targetFill: 5,
    },
  ];
};

const sanitizeCreatedAt = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  if (parsed.getTime() > Date.now()) return new Date();
  return parsed;
};

const parseHistoryTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildEntryCreatedAtMap = (
  historyRows: Array<{ slabId: string; type: string; timestamp: string }>,
) => {
  const map = new Map<string, Date>();
  for (const row of historyRows) {
    if (row.type !== "entry") continue;
    const parsed = parseHistoryTimestamp(row.timestamp);
    if (!parsed) continue;
    const existing = map.get(row.slabId);
    if (!existing || parsed.getTime() < existing.getTime()) {
      map.set(row.slabId, parsed);
    }
  }
  return map;
};

const mapState = (state: SlabBayState) => {
  const slabNotesById = new Map(
    state.slabs.map((slab) => [slab.id, slab.notes?.trim() || null]),
  );

  return {
    racks: state.racks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      capacity: rack.capacity,
      note: rack.note ?? null,
      countTowardInventory: rack.countTowardInventory,
      targetFill: rack.targetFill,
    })),
    slabs: state.slabs.map((slab) => ({
      id: slab.id,
      scannerId: slab.scannerId,
      name: slab.name,
      type: slab.type,
      thickness: slab.thickness,
      size: slab.size,
      clientName: slab.clientName,
      brand: slab.brand?.trim() || null,
      finish: slab.finish?.trim() || null,
      notes: slab.notes?.trim() || null,
      jobId: slab.jobId?.trim() || null,
      rackId: slab.rackId,
      createdAt: sanitizeCreatedAt(slab.createdAt),
      batchId: slab.batchId ?? null,
      batchIndex: slab.batchIndex ?? null,
      batchSize: slab.batchSize ?? null,
    })),
    history: state.history.map((entry) => ({
      id: entry.id,
      type: entry.type,
      slabId: entry.slabId,
      slabScannerId: entry.slabScannerId ?? null,
      slabName: entry.slabName,
      slabType: entry.slabType,
      slabThickness: entry.slabThickness ?? null,
      slabSize: entry.slabSize ?? null,
      slabNotes: entry.slabNotes ?? null,
      slabCreatedAt: entry.slabCreatedAt ?? null,
      clientName: entry.clientName,
      brand: entry.brand ?? null,
      finish: entry.finish ?? null,
      jobId: entry.jobId ?? null,
      entryNote:
        entry.entryNote ??
        (entry.type === "entry"
          ? (slabNotesById.get(entry.slabId) ?? null)
          : null),
      fromRack: entry.fromRack ?? null,
      toRack: entry.toRack ?? null,
      exitNote: entry.exitNote ?? null,
      batchId: entry.batchId ?? null,
      batchIndex: entry.batchIndex ?? null,
      batchSize: entry.batchSize ?? null,
      recoveredFromHistoryId: entry.recoveredFromHistoryId ?? null,
      userName: entry.userName,
      timestamp: entry.timestamp,
    })),
  };
};

export async function GET() {
  await ensureTablesOnce();
  const version = await getCurrentVersion(sql);

  const racks = await sql`
    SELECT * FROM "SlabBayRack" ORDER BY "name" ASC
  `;
  const slabs = await sql`
    SELECT * FROM "SlabBaySlab" ORDER BY "createdAt" DESC
  `;
  const history = await sql`
    SELECT * FROM "SlabBayHistory" ORDER BY "timestamp" DESC
  `;
  const slabNotesById = new Map(
    (slabs as Array<any>).map((slab) => [
      String(slab.id),
      slab.notes ? String(slab.notes) : undefined,
    ]),
  );
  const historyRowsForCreatedAt = Array.from(history, (row) => {
    const record = row as Record<string, unknown>;
    return {
      slabId: String(record.slabId ?? ""),
      type: String(record.type ?? ""),
      timestamp: String(record.timestamp ?? ""),
    };
  });
  const entryCreatedAtBySlabId = buildEntryCreatedAtMap(
    historyRowsForCreatedAt,
  );

  let finalRacks = racks as Array<any>;
  if (finalRacks.length === 0) {
    const defaults = buildDefaultRacks();
    await sql`
      INSERT INTO "SlabBayRack"
      ${sql(
        defaults,
        "id",
        "name",
        "capacity",
        "note",
        "countTowardInventory",
        "targetFill",
      )}
    `;
    finalRacks = (await sql`
      SELECT * FROM "SlabBayRack" ORDER BY "name" ASC
    `) as Array<any>;
  }

  return NextResponse.json({
    version,
    racks: finalRacks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      capacity: rack.capacity,
      note: rack.note ?? undefined,
      countTowardInventory: rack.countTowardInventory,
      targetFill: rack.targetFill,
    })),
    slabs: (slabs as Array<any>).map((slab) => ({
      id: slab.id,
      scannerId: slab.scannerId,
      name: slab.name,
      type: slab.type as
        | "SLAB"
        | "GMD"
        | "REMNANT"
        | "RESERVED"
        | "CLIENT_SLAB",
      thickness: slab.thickness,
      size: slab.size,
      clientName: slab.clientName,
      brand: slab.brand ?? "",
      finish: slab.finish ?? undefined,
      notes: slab.notes ?? undefined,
      jobId: slab.jobId ?? undefined,
      rackId: slab.rackId,
      createdAt: (
        entryCreatedAtBySlabId.get(slab.id) ?? new Date(slab.createdAt)
      ).toISOString(),
      batchId: slab.batchId ?? undefined,
      batchIndex: slab.batchIndex ?? undefined,
      batchSize: slab.batchSize ?? undefined,
    })),
    history: (history as Array<any>).map((entry) => ({
      id: entry.id,
      type: entry.type as "entry" | "exit" | "move" | "change" | "recovery",
      slabId: entry.slabId,
      slabScannerId: entry.slabScannerId ?? undefined,
      slabName: entry.slabName,
      slabType: entry.slabType as
        | "SLAB"
        | "GMD"
        | "REMNANT"
        | "RESERVED"
        | "CLIENT_SLAB",
      slabThickness: entry.slabThickness ?? undefined,
      slabSize: entry.slabSize ?? undefined,
      slabNotes: entry.slabNotes ?? undefined,
      slabCreatedAt: entry.slabCreatedAt ?? undefined,
      clientName: entry.clientName,
      brand: entry.brand ?? undefined,
      finish: entry.finish ?? undefined,
      jobId: entry.jobId ?? undefined,
      entryNote:
        entry.entryNote ??
        (entry.type === "entry"
          ? slabNotesById.get(String(entry.slabId))
          : undefined),
      fromRack: entry.fromRack ?? undefined,
      toRack: entry.toRack ?? undefined,
      exitNote: entry.exitNote ?? undefined,
      batchId: entry.batchId ?? undefined,
      batchIndex: entry.batchIndex ?? undefined,
      batchSize: entry.batchSize ?? undefined,
      recoveredFromHistoryId: entry.recoveredFromHistoryId ?? undefined,
      userName: entry.userName,
      timestamp: entry.timestamp,
    })),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as SlabBayState;
  const mapped = mapState(body);
  await ensureTablesOnce();

  const expectedVersionHeader = request.headers.get("x-slabbay-version");
  const expectedVersion = expectedVersionHeader
    ? Number(expectedVersionHeader)
    : NaN;
  const currentVersion = await getCurrentVersion(sql);

  if (Number.isFinite(expectedVersion) && expectedVersion !== currentVersion) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SlabBay state changed by another request. Please refresh and try again.",
        currentVersion,
      },
      { status: 409 },
    );
  }

  const existingSlabs = (await sql`
    SELECT "id", "createdAt" FROM "SlabBaySlab"
  `) as Array<{ id: string; createdAt: Date | string }>;
  const existingCreatedAtById = new Map(
    existingSlabs.map((slab) => [
      slab.id,
      slab.createdAt instanceof Date
        ? slab.createdAt
        : new Date(slab.createdAt),
    ]),
  );
  const entryCreatedAtBySlabId = buildEntryCreatedAtMap(
    mapped.history.map((entry) => ({
      slabId: entry.slabId,
      type: entry.type,
      timestamp: entry.timestamp,
    })),
  );
  const slabsToPersist = mapped.slabs.map((slab) => ({
    ...slab,
    createdAt:
      entryCreatedAtBySlabId.get(slab.id) ??
      existingCreatedAtById.get(slab.id) ??
      slab.createdAt,
  }));

  let nextVersion = currentVersion + 1;

  await sql.begin(async (trx) => {
    await trx`TRUNCATE TABLE "SlabBayHistory", "SlabBaySlab", "SlabBayRack" CASCADE`;

    if (mapped.racks.length > 0) {
      await trx`
        INSERT INTO "SlabBayRack"
        ${trx(
          mapped.racks,
          "id",
          "name",
          "capacity",
          "note",
          "countTowardInventory",
          "targetFill",
        )}
      `;
    }

    if (slabsToPersist.length > 0) {
      await trx`
        INSERT INTO "SlabBaySlab"
        ${trx(
          slabsToPersist,
          "id",
          "scannerId",
          "name",
          "type",
          "thickness",
          "size",
          "clientName",
          "brand",
          "finish",
          "notes",
          "jobId",
          "rackId",
          "createdAt",
          "batchId",
          "batchIndex",
          "batchSize",
        )}
      `;
    }

    if (mapped.history.length > 0) {
      await trx`
        INSERT INTO "SlabBayHistory"
        ${trx(
          mapped.history,
          "id",
          "type",
          "slabId",
          "slabScannerId",
          "slabName",
          "slabType",
          "slabThickness",
          "slabSize",
          "slabNotes",
          "slabCreatedAt",
          "clientName",
          "brand",
          "finish",
          "jobId",
          "entryNote",
          "fromRack",
          "toRack",
          "exitNote",
          "batchId",
          "batchIndex",
          "batchSize",
          "recoveredFromHistoryId",
          "userName",
          "timestamp",
        )}
      `;
    }

    const versionRows = (await trx`
      UPDATE "SlabBayStateMeta"
      SET "version" = "version" + 1
      WHERE "id" = 1
      RETURNING "version"
    `) as Array<{ version: number }>;

    nextVersion = versionRows[0]?.version ?? nextVersion;
  });

  return NextResponse.json({ ok: true, version: nextVersion });
}
