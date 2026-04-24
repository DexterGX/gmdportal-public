import { NextResponse } from "next/server";
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL || "", {
  ssl: "require",
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slabId: string }> },
) {
  const { slabId } = await params;

  const liveRows = await sql`
    SELECT *
    FROM "SlabBaySlab"
    WHERE "id" = ${slabId} OR "scannerId" = ${slabId}
    LIMIT 1
  `;

  let slabRecord: Record<string, unknown> | null =
    liveRows.length > 0 ? (liveRows[0] as Record<string, unknown>) : null;

  if (!slabRecord) {
    const historyRows = await sql`
      SELECT
        h."slabId" AS "id",
        h."slabScannerId" AS "scannerId",
        h."slabName" AS "name",
        h."slabType" AS "type",
        h."slabThickness" AS "thickness",
        h."slabSize" AS "size",
        h."clientName" AS "clientName",
        h."brand" AS "brand",
        h."finish" AS "finish",
        COALESCE(h."slabNotes", h."exitNote", h."entryNote") AS "notes",
        h."jobId" AS "jobId",
        CASE
          WHEN h."type" = 'exit' THEN 'EXIT'
          ELSE COALESCE(h."toRack", h."fromRack")
        END AS "rackId",
        COALESCE(h."slabCreatedAt", h."timestamp") AS "createdAt"
      FROM "SlabBayHistory" h
      WHERE h."slabId" = ${slabId} OR h."slabScannerId" = ${slabId}
      ORDER BY h."timestamp" DESC
      LIMIT 1
    `;
    slabRecord =
      historyRows.length > 0
        ? (historyRows[0] as Record<string, unknown>)
        : null;
  }

  if (!slabRecord) {
    return NextResponse.json({ error: "Slab not found" }, { status: 404 });
  }

  const slab = slabRecord;

  let jobPipedriveId: string | null = null;
  let clientPipedriveId: string | null = null;
  const rawJobId = slab.jobId ? String(slab.jobId) : "";
  if (rawJobId) {
    const jobRows = await sql`
      SELECT
        j."pipedriveId" AS "jobPipedriveId",
        c."pipedriveId" AS "clientPipedriveId"
      FROM "Job" j
      LEFT JOIN "Customer" c ON c."id" = j."customerId"
      WHERE j."id" = ${rawJobId}
      LIMIT 1
    `;
    if (jobRows.length > 0) {
      const row = jobRows[0] as Record<string, unknown>;
      jobPipedriveId = row.jobPipedriveId ? String(row.jobPipedriveId) : null;
      clientPipedriveId = row.clientPipedriveId
        ? String(row.clientPipedriveId)
        : null;
    }
  }

  // Parse clientName — may encode originalClientName with || separator
  const clientNameRaw = String(slab.clientName ?? "");
  const sepIdx = clientNameRaw.indexOf("||");
  const displayClientName =
    sepIdx !== -1 ? clientNameRaw.slice(0, sepIdx) : clientNameRaw;
  const originalClientName =
    sepIdx !== -1 ? clientNameRaw.slice(sepIdx + 2) : undefined;

  return NextResponse.json({
    id: slab.id,
    scannerId: slab.scannerId,
    name: slab.name,
    type: slab.type,
    thickness: slab.thickness,
    size: slab.size,
    clientName: displayClientName,
    originalClientName,
    brand: slab.brand ?? "",
    finish: slab.finish ?? "",
    notes: slab.notes ?? "",
    jobId: slab.jobId ?? "",
    jobPipedriveId,
    clientPipedriveId,
    rackId: slab.rackId,
    createdAt: slab.createdAt,
  });
}
