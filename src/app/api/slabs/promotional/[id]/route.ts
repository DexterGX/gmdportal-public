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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, soldToClientName, price } = body as {
    status?: string;
    soldToClientName?: string;
    price?: number;
  };

  // Fetch current record
  const [current] = await sql`
    SELECT * FROM "PromotionalSlab" WHERE "id" = ${id}
  `;
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newStatus = status ?? String(current.status);
  const newPrice = price != null ? price : Number(current.price);
  const newSoldTo = newStatus === "SOLD" ? (soldToClientName ?? null) : null;

  const [updated] = await sql`
    UPDATE "PromotionalSlab"
    SET
      "status" = ${newStatus},
      "price" = ${newPrice},
      "soldToClientName" = ${newSoldTo},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING *
  `;

  // If marking as SOLD and a client name was provided, update SlabBay clientName
  if (newStatus === "SOLD" && soldToClientName) {
    await sql`
      UPDATE "SlabBaySlab"
      SET "clientName" = ${soldToClientName}
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
