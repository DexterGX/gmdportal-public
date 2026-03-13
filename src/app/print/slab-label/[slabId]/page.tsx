import postgres from "postgres";
import { notFound } from "next/navigation";
import SlabLabelClient from "./SlabLabelClient";

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL || "", {
  ssl: "require",
});

export default async function SlabLabelPage({
  params,
}: {
  params: Promise<{ slabId: string }>;
}) {
  const { slabId } = await params;

  const rows = await sql`
    SELECT * FROM "SlabBaySlab" WHERE "id" = ${slabId} LIMIT 1
  `;

  if (rows.length === 0) notFound();

  const s = rows[0] as Record<string, unknown>;

  return (
    <SlabLabelClient
      slab={{
        id: String(s.id ?? ""),
        scannerId: String(s.scannerId ?? ""),
        name: String(s.name ?? ""),
        type: String(s.type ?? ""),
        thickness: String(s.thickness ?? ""),
        size: String(s.size ?? ""),
        clientName: String(s.clientName ?? ""),
        brand: String(s.brand ?? ""),
        finish: String(s.finish ?? ""),
        notes: String(s.notes ?? ""),
        jobId: String(s.jobId ?? ""),
        rackId: String(s.rackId ?? ""),
      }}
    />
  );
}
