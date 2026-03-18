import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import postgres from "postgres";
import authOptions from "@/lib/auth";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const sql = postgres(connectionString, {
  ssl: "require",
});

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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deliveryId } = await context.params;
  if (!deliveryId) {
    return NextResponse.json(
      { error: "Missing delivery id." },
      { status: 400 },
    );
  }

  await ensureTable();

  await sql`
    DELETE FROM "SlabBayExpectedDelivery"
    WHERE "id" = ${deliveryId}
  `;

  return NextResponse.json({ ok: true });
}
