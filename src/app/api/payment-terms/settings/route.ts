import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

// GET /api/payment-terms/settings - Get Payment Term settings
export async function GET() {
  try {
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings = await prismaAny.paymentTermSettings.findFirst();

    if (!settings) {
      settings = await prismaAny.paymentTermSettings.create({ data: {} });
    }

    return NextResponse.json({
      templateLaborChargeEnabled: settings.templateLaborChargeEnabled,
    });
  } catch (error) {
    console.error("Error fetching payment term settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

// PATCH /api/payment-terms/settings - Update Payment Term settings (Admin only)
export async function PATCH(request: NextRequest) {
  try {
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.templateLaborChargeEnabled !== "boolean") {
      return NextResponse.json(
        { error: "templateLaborChargeEnabled must be a boolean" },
        { status: 400 },
      );
    }

    let settings = await prismaAny.paymentTermSettings.findFirst();

    if (!settings) {
      settings = await prismaAny.paymentTermSettings.create({
        data: { templateLaborChargeEnabled: body.templateLaborChargeEnabled },
      });
    } else {
      settings = await prismaAny.paymentTermSettings.update({
        where: { id: settings.id },
        data: { templateLaborChargeEnabled: body.templateLaborChargeEnabled },
      });
    }

    return NextResponse.json({
      templateLaborChargeEnabled: settings.templateLaborChargeEnabled,
    });
  } catch (error) {
    console.error("Error updating payment term settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
