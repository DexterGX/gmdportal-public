import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { canAccessProgramId } from "@/lib/programAccess";
import { prisma } from "@/lib/prisma";
import BrandPriceListClient from "./BrandPriceListClient";

type PageProps = {
  params: Promise<{ brandId: string }>;
};

export default async function BrandPriceListPage({ params }: PageProps) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/slabsPriceList");
  }

  const { appRole, appRoles, isActive } = await getCurrentUserWithRole();

  if (!isActive) {
    redirect("/auth/status?reason=inactive");
  }

  if (appRoles.length === 0) {
    redirect("/auth/status?reason=unassigned");
  }

  const hasAccess = await canAccessProgramId("slabs", appRoles, isActive);

  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Await params (Next.js 15 requirement)
  const { brandId } = await params;

  // Fetch brand and slabs
  const brand = await prisma.slabBrandConfig.findUnique({
    where: { id: brandId },
    include: {
      notes: {
        select: {
          id: true,
          title: true,
          content: true,
          catalogUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      slabs: {
        orderBy: { color: "asc" },
      },
    },
  });

  if (!brand) {
    notFound();
  }

  // Convert Decimal values to numbers for client component
  const serializedBrand = {
    ...brand,
    isAdmin: appRole === "admin",
    notes: brand.notes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      catalogUrl: note.catalogUrl,
      createdAt: note.createdAt.toISOString(),
    })),
    profitFactor: brand.profitFactor.toNumber(),
    taxRate: brand.taxRate.toNumber(),
    deliveryFee: brand.deliveryFee.toNumber(),
    discount: brand.discount.toNumber(),
    slabs: brand.slabs.map((slab) => ({
      ...slab,
      widthIn: slab.widthIn.toNumber(),
      heightIn: slab.heightIn.toNumber(),
      providerPrice: slab.providerPrice.toNumber(),
      finalPrice: slab.finalPrice.toNumber(),
    })),
  };

  // Precompute distinct filter options
  const filterOptions = {
    series: Array.from(
      new Set(brand.slabs.map((s) => s.series).filter((s): s is string => !!s)),
    ).sort(),
    finishes: Array.from(
      new Set(brand.slabs.map((s) => formatFinish(s.finish))),
    ).sort(),
    thicknesses: Array.from(
      new Set(brand.slabs.map((s) => formatThickness(s.thickness))),
    ).sort(),
    statuses: Array.from(new Set(brand.slabs.map((s) => s.status))).sort(),
    sizes: Array.from(
      new Set(
        brand.slabs.map((s) =>
          formatSize(s.heightIn.toNumber(), s.widthIn.toNumber()),
        ),
      ),
    ).sort(),
  };

  return (
    <BrandPriceListClient
      brand={serializedBrand}
      filterOptions={filterOptions}
    />
  );
}

// Helper functions for filter options (used server-side)
function formatFinish(finish: string): string {
  return finish
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatThickness(thickness: string): string {
  switch (thickness) {
    case "TWO_CM":
      return "2cm";
    case "THREE_CM":
      return "3cm";
    case "EIGHT_MM":
      return "8mm";
    case "TWELVE_MM":
      return "12mm";
    default:
      return thickness;
  }
}

function formatSize(heightIn: number, widthIn: number): string {
  return `${Math.round(heightIn)} x ${Math.round(widthIn)} in`;
}
