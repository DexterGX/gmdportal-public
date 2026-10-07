import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { QUOTE_REPAIR_SERVICE_DEFAULTS } from "@/lib/quoteRepairs";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const { user, appRole, appRoles } = await getProgramUserContext("quoteRepairs");
  if (!user || appRoles.length === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await prisma.quoteRepairSettings.findFirst();
  const ensuredSettings = settings || await prisma.quoteRepairSettings.create({ data: {} });
  let services = await prisma.quoteRepairService.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (services.length === 0) {
    await prisma.quoteRepairService.createMany({
      data: QUOTE_REPAIR_SERVICE_DEFAULTS.map((name, index) => ({
        name,
        active: true,
        sortOrder: index + 1,
      })),
      skipDuplicates: true,
    });

    services = await prisma.quoteRepairService.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  return NextResponse.json({
    settings: ensuredSettings,
    services,
  });
}

export async function PATCH(request: NextRequest) {
  const { user, appRole, appRoles } = await getProgramUserContext("quoteRepairs");
  if (!user || appRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();

  const action = normalizeText(body?.action);

  if (action === "create_service") {
    const name = normalizeText(body?.name);
    if (!name) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }

    const maxSortOrder = await prisma.quoteRepairService.aggregate({
      _max: { sortOrder: true },
    });

    const created = await prisma.quoteRepairService.create({
      data: {
        name,
        active: true,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
      },
    }).catch((error: { code?: string }) => {
      if (error?.code === "P2002") {
        return null;
      }
      throw error;
    });

    if (!created) {
      return NextResponse.json({ error: "Service already exists" }, { status: 409 });
    }
  }

  if (action === "delete_service") {
    const serviceId = normalizeText(body?.serviceId);
    if (!serviceId) {
      return NextResponse.json({ error: "Service id is required" }, { status: 400 });
    }
    await prisma.quoteRepairService.delete({ where: { id: serviceId } });
  }

  if (!action || action === "update_settings") {
    let settings = await prisma.quoteRepairSettings.findFirst();
    if (!settings) settings = await prisma.quoteRepairSettings.create({ data: {} });

    await prisma.quoteRepairSettings.update({
      where: { id: settings.id },
      data: {
        authorizationText: body.authorizationText,
        hoaPermitNote: body.hoaPermitNote,
        defaultCustomerTerms: body.defaultCustomerTerms,
        footerText: body.footerText,
      },
    });
  }

  let settings = await prisma.quoteRepairSettings.findFirst();
  if (!settings) settings = await prisma.quoteRepairSettings.create({ data: {} });

  const services = await prisma.quoteRepairService.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ settings, services });
}
