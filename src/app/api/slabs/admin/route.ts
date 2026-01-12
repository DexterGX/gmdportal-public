import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

// Helper to map DB thickness enum to UI format
function mapThicknessToUI(dbThickness: string): "8mm" | "12mm" | "2cm" | "3cm" {
  switch (dbThickness) {
    case "EIGHT_MM":
      return "8mm";
    case "TWELVE_MM":
      return "12mm";
    case "TWO_CM":
      return "2cm";
    case "THREE_CM":
      return "3cm";
    default:
      return "2cm";
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const brandIds =
      searchParams.get("brandIds")?.split(",").filter(Boolean) || [];
    const series = searchParams.get("series")?.split(",").filter(Boolean) || [];
    const finishes =
      searchParams.get("finishes")?.split(",").filter(Boolean) || [];
    const hxws = searchParams.get("hxws")?.split(",").filter(Boolean) || [];
    const thicknesses =
      searchParams.get("thicknesses")?.split(",").filter(Boolean) || [];
    const statuses =
      searchParams.get("statuses")?.split(",").filter(Boolean) || [];
    const sortBy = searchParams.get("sortBy") || "color";
    const sortDir = (searchParams.get("sortDir") || "asc") as "asc" | "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    // Build WHERE clause
    const where: any = {};

    if (search) {
      where.color = {
        contains: search,
        mode: "insensitive",
      };
    }

    if (brandIds.length > 0) {
      where.brandId = {
        in: brandIds,
      };
    }

    if (series.length > 0) {
      where.series = {
        in: series,
      };
    }

    if (finishes.length > 0) {
      where.finish = {
        in: finishes,
      };
    }

    if (statuses.length > 0) {
      where.status = {
        in: statuses,
      };
    }

    // Handle thickness filter (convert UI format to DB enum)
    if (thicknesses.length > 0) {
      const dbThicknesses = thicknesses.map((t) => {
        switch (t) {
          case "8mm":
            return "EIGHT_MM";
          case "12mm":
            return "TWELVE_MM";
          case "2cm":
            return "TWO_CM";
          case "3cm":
            return "THREE_CM";
          default:
            return "TWO_CM";
        }
      });
      where.thickness = {
        in: dbThicknesses,
      };
    }

    // Handle HxW filter (requires complex OR condition)
    if (hxws.length > 0) {
      const hxwConditions = hxws
        .map((hxw) => {
          const match = hxw.match(/^([\d.]+)\s*x\s*([\d.]+)\s*in$/i);
          if (match) {
            return {
              heightIn: parseFloat(match[1]),
              widthIn: parseFloat(match[2]),
            };
          }
          return null;
        })
        .filter(Boolean);

      if (hxwConditions.length > 0) {
        where.OR = hxwConditions;
      }
    }

    // Build ORDER BY clause
    const orderBy: any = {};

    // Map sortBy to actual DB field
    const sortFieldMap: Record<string, string> = {
      color: "color",
      series: "series",
      code: "providerCode",
      finish: "finish",
      thickness: "thickness",
      listedPrice: "providerPrice",
      finalPrice: "finalPrice",
      status: "status",
      brand: "brandId", // Will need to join for proper brand name sorting
    };

    const dbSortField = sortFieldMap[sortBy] || "color";

    // Add primary sort field
    orderBy[dbSortField] = sortDir;

    // Add secondary sort by ID for stable pagination
    if (dbSortField !== "id") {
      // If sorting by multiple fields, use array
      const orderByArray = [{ [dbSortField]: sortDir }, { id: "asc" as const }];

      // Get total count
      const total = await prisma.slab.count({ where });

      // Get paginated slabs
      const skip = (page - 1) * pageSize;
      const slabs = await prisma.slab.findMany({
        where,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: orderByArray,
        skip,
        take: pageSize,
      });

      // Transform to match AdminSlabRow structure
      const transformedSlabs = slabs.map((slab) => ({
        id: slab.id,
        slabNumber: slab.slabNumber,
        brand: slab.brand.name,
        brandId: slab.brandId,
        series: slab.series,
        code: slab.providerCode,
        color: slab.color,
        finish: slab.finish,
        heightIn: parseFloat(slab.heightIn.toString()),
        widthIn: parseFloat(slab.widthIn.toString()),
        thickness: mapThicknessToUI(slab.thickness),
        listedPrice: parseFloat(slab.providerPrice.toString()),
        finalPrice: parseFloat(slab.finalPrice.toString()),
        status: slab.status as "AVAILABLE" | "UNAVAILABLE" | "DISCONTINUED",
      }));

      return NextResponse.json({
        rows: transformedSlabs,
        total,
        page,
        pageSize,
      });
    }

    // Fallback (shouldn't reach here, but just in case)
    const total = await prisma.slab.count({ where });
    const skip = (page - 1) * pageSize;
    const slabs = await prisma.slab.findMany({
      where,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { [dbSortField]: sortDir },
      skip,
      take: pageSize,
    });

    const transformedSlabs = slabs.map((slab) => ({
      id: slab.id,
      slabNumber: slab.slabNumber,
      brand: slab.brand.name,
      brandId: slab.brandId,
      series: slab.series,
      code: slab.providerCode,
      color: slab.color,
      finish: slab.finish,
      heightIn: parseFloat(slab.heightIn.toString()),
      widthIn: parseFloat(slab.widthIn.toString()),
      thickness: mapThicknessToUI(slab.thickness),
      listedPrice: parseFloat(slab.providerPrice.toString()),
      finalPrice: parseFloat(slab.finalPrice.toString()),
      status: slab.status as "AVAILABLE" | "UNAVAILABLE" | "DISCONTINUED",
    }));

    return NextResponse.json({
      rows: transformedSlabs,
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error("Error fetching slabs:", error);
    return NextResponse.json(
      { error: "Failed to fetch slabs", details: error.message },
      { status: 500 }
    );
  }
}
