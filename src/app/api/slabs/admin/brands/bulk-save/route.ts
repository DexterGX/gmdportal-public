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
      let savedBrand;

      if (brand._isNew || !brand.id || brand.id.startsWith("new-")) {
        // Create new brand
        savedBrand = await prisma.slabBrandConfig.create({
          data: {
            brandNumber: brand.brandNumber,
            name: brand.brandName,
            profitFactor: new Decimal(brand.factor),
            taxRate: new Decimal(brand.tax),
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
        // Update existing brand
        savedBrand = await prisma.slabBrandConfig.update({
          where: { id: brand.id },
          data: {
            brandNumber: brand.brandNumber,
            name: brand.brandName,
            profitFactor: new Decimal(brand.factor),
            taxRate: new Decimal(brand.tax),
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

      // Transform back to UI format
      savedBrands.push({
        id: savedBrand.id,
        brandNumber: savedBrand.brandNumber,
        brandName: savedBrand.name,
        factor: parseFloat(savedBrand.profitFactor.toString()),
        tax: parseFloat(savedBrand.taxRate.toString()),
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
