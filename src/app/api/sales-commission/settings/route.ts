import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session;
}

// GET /api/sales-commission/settings
export async function GET() {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings = await p.cMSSettings.findFirst();
  if (!settings) {
    settings = await p.cMSSettings.create({
      data: {
        firstPaymentPercent: 60,
        secondPaymentPercent: 40,
        minWeeklyPay: 560,
        colorPending: "#FFFFFF",
        colorFirstPayment: "#BFDBFE",
        colorFirstPaid: "#F0F9FF",
        colorClosing: "#BBF7D0",
        colorHold: "#FEF08A",
        colorHoldSignature: "#FBCFE8",
        colorError: "#FECACA",
      },
    });
  }

  return NextResponse.json(settings);
}

// PUT /api/sales-commission/settings
export async function PUT(req: NextRequest) {
  const session = await checkAuth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // The settings form always submits the full CMSSettings shape. Before a
  // row exists it starts from DEFAULT_SETTINGS, whose id/createdAt/updatedAt
  // are empty-string placeholders -- passing those straight to Prisma fails
  // create()/update() with an invalid ISO-8601 date. Strip them so Prisma
  // generates/keeps its own id and timestamps.
  const data: Record<string, unknown> = { ...(body ?? {}) };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  let settings = await p.cMSSettings.findFirst();

  if (!settings) {
    settings = await p.cMSSettings.create({ data });
  } else {
    settings = await p.cMSSettings.update({
      where: { id: settings.id },
      data,
    });
  }

  return NextResponse.json(settings);
}
