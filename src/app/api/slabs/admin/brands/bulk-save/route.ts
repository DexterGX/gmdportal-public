import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is ADMIN
    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { brands } = body;

    if (!Array.isArray(brands) || brands.length === 0) {
      return NextResponse.json(
        { error: "Invalid request - brands array required" },
        { status: 400 }
      );
    }

    const savedBrands = [];

    for (const brand of brands) {
      // Handle deletions
      if (brand._deleted) {
        if (!brand._isNew && brand.id && !brand.id.startsWith("new-")) {
          await prisma.slabBrandConfig.delete({
            where: { id: brand.id },
          });
        }
        continue; // Skip adding to savedBrands
      }

      let savedBrand;

      if (brand._isNew || !brand.id || brand.id.startsWith("new-")) {
        // Auto-assign brandNumber if null
        let brandNumber = brand.brandNumber;
        if (!brandNumber) {
          const maxBrand = await prisma.slabBrandConfig.findFirst({
            orderBy: { brandNumber: "desc" },
            select: { brandNumber: true },
          });
          brandNumber = (maxBrand?.brandNumber ?? 0) + 1;
        }

        // Create new brand - convert tax factor to rate (1.07 → 0.07)
        savedBrand = await prisma.slabBrandConfig.create({
          data: {
            brandNumber: brandNumber,
            name: brand.brandName,
            profitFactor: new Decimal(brand.factor),
            taxRate: new Decimal(brand.tax - 1), // Convert factor to rate
            deliveryFee: new Decimal(brand.freight),
            discount: new Decimal(brand.discount),
            lastUpdate: new Date(),
            contactName: brand.contactName,
            contactNumber: brand.contactPhone,
            contactCell: brand.contactCell,
            contactEmail: brand.email,
          },
        });
      } else {
        // Update existing brand - convert tax factor to rate (1.07 → 0.07)
        savedBrand = await prisma.slabBrandConfig.update({
          where: { id: brand.id },
          data: {
            brandNumber: brand.brandNumber,
            name: brand.brandName,
            profitFactor: new Decimal(brand.factor),
            taxRate: new Decimal(brand.tax - 1), // Convert factor to rate
            deliveryFee: new Decimal(brand.freight),
            discount: new Decimal(brand.discount),
            lastUpdate: new Date(),
            contactName: brand.contactName,
            contactNumber: brand.contactPhone,
            contactCell: brand.contactCell,
            contactEmail: brand.email,
          },
        });
      }

      // Transform back to UI format - convert tax rate to factor (0.07 → 1.07)
      savedBrands.push({
        id: savedBrand.id,
        brandNumber: savedBrand.brandNumber,
        brandName: savedBrand.name,
        factor: parseFloat(savedBrand.profitFactor.toString()),
        tax: 1 + parseFloat(savedBrand.taxRate.toString()), // Convert to factor
        freight: parseFloat(savedBrand.deliveryFee.toString()),
        discount: parseFloat(savedBrand.discount.toString()),
        contactName: savedBrand.contactName,
        contactCell: savedBrand.contactCell,
        contactPhone: savedBrand.contactNumber,
        email: savedBrand.contactEmail,
        lastUpdated: savedBrand.lastUpdate
          ? savedBrand.lastUpdate.toISOString()
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      brands: savedBrands,
      message: `Successfully saved ${savedBrands.length} brand(s)`,
    });
  } catch (error: any) {
    console.error("Error saving brands:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save brands" },
      { status: 500 }
    );
  }
}
