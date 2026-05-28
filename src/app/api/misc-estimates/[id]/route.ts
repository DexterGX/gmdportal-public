import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireUserEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return null;
  }
  return email;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const normalizedId = id?.trim();
    if (!normalizedId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const estimate = await prismaAny.miscEstimate.findUnique({
      where: { id: normalizedId },
      include: {
        ledRows: {
          include: {
            room: { select: { id: true, name: true } },
            ledType: { select: { id: true, name: true, pricePerFt: true } },
            controlType: { select: { id: true, name: true, unitPrice: true } },
            profile: { select: { id: true, name: true, unitPrice: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!estimate) {
      const artifact = await prisma.jobArtifact.findFirst({
        where: { id: normalizedId, sourceApp: "MISC_ESTIMATE" },
        select: { id: true, title: true, metadata: true, createdAt: true },
      });

      if (!artifact) {
        return NextResponse.json(
          { error: "Estimate not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        id: artifact.id,
        title: artifact.title,
        metadata: artifact.metadata ?? {},
        createdAt: artifact.createdAt,
      });
    }

    const ledRows = estimate.ledRows.map((row: any) => {
      const linearFeet = toNumber(row.linearFeet);
      const profileQty = toNumber(row.profileQty);
      return {
        id: row.id,
        roomId: row.roomId,
        room: row.room?.name ?? "",
        lnFt: linearFeet,
        linearFeet,
        ledTypeId: row.ledTypeId,
        ledType: row.ledType?.name ?? "",
        controlTypeId: row.controlTypeId,
        controlType: row.controlType?.name ?? "",
        profileId: row.profileId,
        profile: row.profile?.name ?? "",
        profileQty,
        subtotal: toNumber(row.subtotal),
      };
    });

    return NextResponse.json({
      id: estimate.id,
      estimateNumber: estimate.estimateNo,
      title: estimate.title,
      metadata: {
        estimateNumber: estimate.estimateNo,
        title: estimate.title,
        customerId: estimate.clientId,
        customerName: estimate.clientName,
        jobId: null,
        dealId: estimate.dealId,
        dealName: estimate.dealName,
        date: estimate.date.toISOString().slice(0, 10),
        salesRep: estimate.salesRep,
        ledStripRows: ledRows,
        ledStripSubtotal: toNumber(estimate.subtotal),
      },
      createdAt: estimate.createdAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load estimate" },
      { status: 500 },
    );
  }
}
