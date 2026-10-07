import React from "react";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import SlabsAdminTable from "./SlabsAdminTable";

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

export default async function SlabDataPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/slabsPriceList/admin/slabs");
  }

  // Check if user is ADMIN
  const { appRole } = await getProgramUserContext("slabs");
  if (appRole !== "admin") {
    redirect("/slabsPriceList");
  }

  const userName =
    session.user?.name || session.user?.email || "Unknown User";

  // Fetch initial page of slabs with brand information (for SSR)
  // The client component will handle pagination and filtering via API
  const initialPageSize = 100;

  const [slabs, total] = await Promise.all([
    prisma.slab.findMany({
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ color: "asc" }, { id: "asc" }],
      take: initialPageSize,
    }),
    prisma.slab.count(),
  ]);

  // Fetch all brands for dropdown
  const brands = await prisma.slabBrandConfig.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Get unique finishes for filter
  const finishes = [
    "CONCRETE",
    "HONED",
    "LEATHER",
    "MATTE",
    "NATURAL",
    "OTHER",
    "POLISHED",
    "ROUGH",
    "STONE",
    "ULTRA_ROUGH",
    "SATIN",
    "SATIN_HONED",
    "PATINATO",
    "LEVIGATO_PEARL",
    "GLAM",
    "GINZA",
    "HOLOS",
    "TWILL",
    "JUTA",
    "DENIM",
    "DAMIER",
    "LAVA",
  ];

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

  // Computed once at request time (this page is already dynamic — it reads
  // the session and fetches live data on every load) so the "Printed by"
  // line can sit right on the title's line in the print output.
  const printedAt = new Date();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Slab Data
          </h1>
          <div className="hidden print:block text-xs text-gray-600">
            Printed by {userName} on {printedAt.toLocaleDateString()} at{" "}
            {printedAt.toLocaleTimeString()}
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          View and manage full slab records and provider prices.
        </p>
      </div>

      {/* Editable Table Component */}
      <SlabsAdminTable
        initialData={transformedSlabs}
        initialTotal={total}
        initialPage={1}
        initialPageSize={initialPageSize}
        brands={brands}
        finishes={finishes}
      />
    </div>
  );
}
