import { NextResponse } from "next/server";
import postgres from "postgres";
import type { SlabBayState } from "@/app/slab-rack-display/ui/mockData";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const sql = postgres(connectionString, {
  ssl: "require",
});

const ensureTables = async () => {
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
      "rackId" TEXT NOT NULL REFERENCES "SlabBayRack"("id") ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "SlabBayHistory" (
      "id" TEXT PRIMARY KEY,
      "type" TEXT NOT NULL,
      "slabId" TEXT NOT NULL,
      "slabScannerId" TEXT,
      "slabName" TEXT NOT NULL,
      "slabType" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "fromRack" TEXT,
      "toRack" TEXT,
      "exitNote" TEXT,
      "userName" TEXT NOT NULL,
      "timestamp" TEXT NOT NULL
    );
  `;
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

const mapState = (state: SlabBayState) => ({
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
    rackId: slab.rackId,
    createdAt: new Date(slab.createdAt),
  })),
  history: state.history.map((entry) => ({
    id: entry.id,
    type: entry.type,
    slabId: entry.slabId,
    slabScannerId: entry.slabScannerId ?? null,
    slabName: entry.slabName,
    slabType: entry.slabType,
    clientName: entry.clientName,
    fromRack: entry.fromRack ?? null,
    toRack: entry.toRack ?? null,
    exitNote: entry.exitNote ?? null,
    userName: entry.userName,
    timestamp: entry.timestamp,
  })),
});

export async function GET() {
  await ensureTables();

  const racks = await sql`
    SELECT * FROM "SlabBayRack" ORDER BY "name" ASC
  `;
  const slabs = await sql`
    SELECT * FROM "SlabBaySlab" ORDER BY "createdAt" DESC
  `;
  const history = await sql`
    SELECT * FROM "SlabBayHistory" ORDER BY "timestamp" DESC
  `;

  if (racks.length === 0) {
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
    return NextResponse.json({
      racks: defaults.map((rack) => ({
        id: rack.id,
        name: rack.name,
        capacity: rack.capacity,
        note: rack.note ?? undefined,
        countTowardInventory: rack.countTowardInventory,
        targetFill: rack.targetFill,
      })),
      slabs: [],
      history: [],
    });
  }

  return NextResponse.json({
    racks: (racks as Array<any>).map((rack) => ({
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
      type: slab.type as "SLAB" | "GMD" | "REMNANT" | "RESERVED",
      thickness: slab.thickness,
      size: slab.size,
      clientName: slab.clientName,
      rackId: slab.rackId,
      createdAt: new Date(slab.createdAt).toISOString(),
    })),
    history: (history as Array<any>).map((entry) => ({
      id: entry.id,
      type: entry.type as "entry" | "exit" | "move",
      slabId: entry.slabId,
      slabScannerId: entry.slabScannerId ?? undefined,
      slabName: entry.slabName,
      slabType: entry.slabType as "SLAB" | "GMD" | "REMNANT" | "RESERVED",
      clientName: entry.clientName,
      fromRack: entry.fromRack ?? undefined,
      toRack: entry.toRack ?? undefined,
      exitNote: entry.exitNote ?? undefined,
      userName: entry.userName,
      timestamp: entry.timestamp,
    })),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as SlabBayState;
  const mapped = mapState(body);
  await ensureTables();

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

    if (mapped.slabs.length > 0) {
      await trx`
        INSERT INTO "SlabBaySlab"
        ${trx(
          mapped.slabs,
          "id",
          "scannerId",
          "name",
          "type",
          "thickness",
          "size",
          "clientName",
          "rackId",
          "createdAt",
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
          "clientName",
          "fromRack",
          "toRack",
          "exitNote",
          "userName",
          "timestamp",
        )}
      `;
    }
  });

  return NextResponse.json({ ok: true });
}
