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

  const rows = await sql`
    SELECT *
    FROM "SlabBaySlab"
    WHERE "id" = ${slabId} OR "scannerId" = ${slabId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Slab not found" }, { status: 404 });
  }

  const slab = rows[0] as Record<string, unknown>;

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
    rackId: slab.rackId,
    createdAt: slab.createdAt,
  });
}
