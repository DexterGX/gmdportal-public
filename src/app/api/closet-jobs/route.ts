import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const LEGACY_AREA_KEYS = [
  "MASTER",
  "GUEST",
  "GARAGE",
  "KITCHEN",
  "WALL_UNIT",
  "LAUNDRY",
  "OTHER",
] as const;

function mapToLegacyArea(areas: string[]):
  | "MASTER"
  | "GUEST"
  | "GARAGE"
  | "KITCHEN"
  | "WALL_UNIT"
  | "LAUNDRY"
  | "OTHER" {
  const firstKnown = areas.find((item) =>
    LEGACY_AREA_KEYS.includes(item as (typeof LEGACY_AREA_KEYS)[number])
  );
  return (firstKnown as
    | "MASTER"
    | "GUEST"
    | "GARAGE"
    | "KITCHEN"
    | "WALL_UNIT"
    | "LAUNDRY"
    | "OTHER") || "OTHER";
}

// GET /api/closet-jobs - List all closet jobs
export async function GET(request: NextRequest) {
  try {
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN, SALES, and INSTALLER can view jobs
    if (!["admin", "sales", "installer"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const jobs = await prisma.closetJob.findMany({
      where: appRole === "installer" ? { installerId: user.id } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        quotes: {
          select: {
            id: true,
            quoteCode: true,
            status: true,
            finalPrice: true,
          },
        },
      },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error fetching closet jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch closet jobs" },
      { status: 500 },
    );
  }
}

// POST /api/closet-jobs - Create a new closet job (Sales only)
export async function POST(request: NextRequest) {
  try {
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and SALES can create jobs
    if (!["admin", "sales"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerName,
      customerPhone,
      propertyAddress,
      area,
      areas,
      installerId,
      salesPersonId,
      notesSales,
    } = body;

    const normalizedAreas = Array.from(
      new Set(
        (Array.isArray(areas) ? areas : [area])
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      )
    );

    // Validate required fields
    if (!customerName || !propertyAddress || !installerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (normalizedAreas.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const effectiveSalesPersonId = salesPersonId || user.id;

    const assignedSalesPerson = await prisma.user.findFirst({
      where: {
        id: effectiveSalesPersonId,
        active: true,
        role: {
          in: ["ADMIN", "SALES"],
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!assignedSalesPerson) {
      return NextResponse.json(
        { error: "Selected sales person is invalid or inactive" },
        { status: 400 }
      );
    }

    // Get settings for quote number format
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

    // Generate quote number using format
    const now = new Date();
    const format = settings.quoteNumberFormat;

    // Extract initials from sales person name
    let initials = "XX";
    if (assignedSalesPerson?.name) {
      const nameParts = assignedSalesPerson.name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        initials = `${nameParts[0][0]}${
          nameParts[nameParts.length - 1][0]
        }`.toUpperCase();
      } else if (nameParts.length === 1) {
        initials = `${nameParts[0][0]}${nameParts[0][1] || ""}`.toUpperCase();
      }
    }

    // Format date as YYMMDD
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const yymmdd = `${yy}${mm}${dd}`;

    // Get sequence number for today (count jobs created today with same date pattern)
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const jobsToday = await prisma.closetJob.count({
      where: {
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    const seq3 = String(jobsToday + 1).padStart(3, "0");

    // Replace tokens in format
    const quoteNumber = format
      .replace("{INITIALS}", initials)
      .replace("{YYMMDD}", yymmdd)
      .replace("{SEQ3}", seq3);

    // Create the job
    const job = await prisma.closetJob.create({
      data: {
        quoteNumber,
        customerName,
        customerPhone,
        propertyAddress,
        area: mapToLegacyArea(normalizedAreas),
        areas: normalizedAreas,
        installerId,
        salesPersonId: assignedSalesPerson.id,
        notesSales: notesSales?.trim() || null,
        status: "QUOTE",
        quoteStartedAt: new Date(),
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("Error creating closet job:", error);
    return NextResponse.json(
      { error: "Failed to create closet job" },
      { status: 500 },
    );
  }
}
