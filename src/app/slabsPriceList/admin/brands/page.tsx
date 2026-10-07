import React from "react";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import BrandSettingsTable from "./BrandSettingsTable";

export default async function BrandSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/slabsPriceList/admin/brands");
  }

  // Check if user is ADMIN
  const { appRole } = await getProgramUserContext("slabs");
  if (appRole !== "admin") {
    redirect("/slabsPriceList");
  }

  // Fetch all brand configs ordered by name
  const brands = await prisma.slabBrandConfig.findMany({
    orderBy: {
      name: "asc",
    },
  });

  // Transform to match new BrandSettingsRow structure
  const transformedBrands = brands.map((brand) => ({
    id: brand.id,
    brandNumber: brand.brandNumber,
    brandName: brand.name,
    logoUrl: brand.logoUrl,
    factor: parseFloat(brand.profitFactor.toString()),
    tax: 1 + parseFloat(brand.taxRate.toString()), // Convert to factor (0.07 → 1.07)
    freight: parseFloat(brand.deliveryFee.toString()),
    discount: parseFloat(brand.discount.toString()),
    contactName: brand.contactName,
    contactCell: brand.contactCell,
    contactPhone: brand.contactNumber,
    email: brand.contactEmail,
    lastUpdated: brand.lastUpdate ? brand.lastUpdate.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Brand Settings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure profit factors, taxes and delivery fees per brand.
        </p>
      </div>

      {/* Editable Table Component */}
      <BrandSettingsTable initialData={transformedBrands} />
    </div>
  );
}
