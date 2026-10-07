import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

// GET /api/closet-jobs/settings - Get settings
export async function GET(request: NextRequest) {
  try {
    const { user, appRole, appRoles } = await getProgramUserContext("closetJobs");

    if (!user || appRoles.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create settings (single row)
    let settings = await prisma.closetEstimateSettings.findFirst();

    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.closetEstimateSettings.create({
        data: {
          defaultGmFactor: 1.35,
          quoteNumberFormat: "{INITIALS}-CQUO-{YYMMDD}-{SEQ3}",
        },
      });
    }

    return NextResponse.json({
      defaultGmFactor: settings.defaultGmFactor.toString(),
      quoteNumberFormat: settings.quoteNumberFormat,
      printLogoUrl: settings.printLogoUrl,
      printCompanyName: settings.printCompanyName,
      printCompanyLine1: settings.printCompanyLine1,
      printCompanyLine2: settings.printCompanyLine2,
      printCompanyPhone: settings.printCompanyPhone,
      printHeaderTitle: settings.printHeaderTitle,
      printOverviewTemplate: settings.printOverviewTemplate,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/closet-jobs/settings - Update settings (Admin only)
export async function PATCH(request: NextRequest) {
  try {
    const { user, appRole, appRoles } = await getProgramUserContext("closetJobs");

    if (!user || appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      defaultGmFactor,
      quoteNumberFormat,
      printLogoUrl,
      printCompanyName,
      printCompanyLine1,
      printCompanyLine2,
      printCompanyPhone,
      printHeaderTitle,
      printOverviewTemplate,
    } = body;

    // Get or create settings
    let settings = await prisma.closetEstimateSettings.findFirst();

    const updateData: any = {};
    if (defaultGmFactor !== undefined) {
      updateData.defaultGmFactor = parseFloat(defaultGmFactor);
    }
    if (quoteNumberFormat !== undefined) {
      updateData.quoteNumberFormat = quoteNumberFormat;
    }
    if (printLogoUrl !== undefined) {
      updateData.printLogoUrl = printLogoUrl;
    }
    if (printCompanyName !== undefined) {
      updateData.printCompanyName = printCompanyName;
    }
    if (printCompanyLine1 !== undefined) {
      updateData.printCompanyLine1 = printCompanyLine1;
    }
    if (printCompanyLine2 !== undefined) {
      updateData.printCompanyLine2 = printCompanyLine2;
    }
    if (printCompanyPhone !== undefined) {
      updateData.printCompanyPhone = printCompanyPhone;
    }
    if (printHeaderTitle !== undefined) {
      updateData.printHeaderTitle = printHeaderTitle;
    }
    if (printOverviewTemplate !== undefined) {
      updateData.printOverviewTemplate = printOverviewTemplate;
    }

    if (!settings) {
      // Create if doesn't exist
      settings = await prisma.closetEstimateSettings.create({
        data: {
          defaultGmFactor: updateData.defaultGmFactor || 1.35,
          quoteNumberFormat:
            updateData.quoteNumberFormat || "{INITIALS}-CQUO-{YYMMDD}-{SEQ3}",
        },
      });
    } else {
      // Update existing
      settings = await prisma.closetEstimateSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      defaultGmFactor: settings.defaultGmFactor.toString(),
      quoteNumberFormat: settings.quoteNumberFormat,
      printLogoUrl: settings.printLogoUrl,
      printCompanyName: settings.printCompanyName,
      printCompanyLine1: settings.printCompanyLine1,
      printCompanyLine2: settings.printCompanyLine2,
      printCompanyPhone: settings.printCompanyPhone,
      printHeaderTitle: settings.printHeaderTitle,
      printOverviewTemplate: settings.printOverviewTemplate,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
