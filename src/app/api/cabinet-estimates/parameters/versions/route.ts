import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import {
  getProgramVersion,
  nextProgramVersion,
  type ProgramVersionBumpKind,
} from "@/lib/cabinetProgramVersion";

const prismaAny = prisma as any;

async function requireAdmin() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRoles.length === 0) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (appRole !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return NextResponse.json(await getProgramVersion(prismaAny));
}

// Logs a new version. Body: { kind: "major" | "minor" | "tables", note?, hidden? }
// hidden=true keeps the public version unchanged (admins still see the new one).
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const kind = body.kind as ProgramVersionBumpKind;
    if (kind !== "major" && kind !== "minor" && kind !== "tables") {
      return NextResponse.json({ error: "Invalid update type" }, { status: 400 });
    }
    const note = String(body.note || "").trim().slice(0, 500);
    const hidden = Boolean(body.hidden);

    const current = await getProgramVersion(prismaAny);
    const latest = current.log[0];
    const next = nextProgramVersion(latest, kind);

    await prismaAny.cabinetProgramVersionLog.create({
      data: {
        ...next,
        kind,
        note,
        hidden,
        createdById: auth.user.id,
        createdByName: auth.user.name || auth.user.email || "",
      },
    });
    return NextResponse.json(await getProgramVersion(prismaAny), { status: 201 });
  } catch (error: any) {
    console.error("Failed to log version update", error);
    return NextResponse.json(
      { error: error?.message || "Failed to log version update" },
      { status: 500 },
    );
  }
}
