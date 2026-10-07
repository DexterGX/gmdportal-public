import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

/**
 * GET /api/cabinet-catalog/vendors
 *
 * Active vendors, for the estimate form's Brand selector, the admin import
 * page's vendor picker, and the Cabinet Companies page's "linked catalog
 * vendor" selector. Round 6: also returns each vendor's linked company
 * (providerId) plus that company's discount/factor, so the import page can
 * pre-fill a discount value and the Companies page can show link state.
 */
export async function GET() {
  try {
    const { isActive } = await getProgramUserContext("cabinetEstimates");
    if (!isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Round 6 follow-up: Diego's mental model is that vendors ARE the
    // cabinet companies - he doesn't want a separate manual "link vendor"
    // step before a company shows up here. Self-heal before listing: any
    // active company with no linked CabinetVendor yet gets one created
    // automatically (name = the company's actualName), so newly-added
    // companies just work here with zero extra steps.
    const activeCompanies = await prismaAny.cabinetProviderSettings.findMany({
      where: { isActive: true },
      select: { id: true, actualName: true, cabinetVendor: { select: { id: true } } },
    });
    const unlinkedCompanies = activeCompanies.filter((c: any) => !c.cabinetVendor);
    for (const company of unlinkedCompanies) {
      try {
        await prismaAny.cabinetVendor.create({
          data: { name: company.actualName, providerId: company.id },
        });
      } catch (err: any) {
        // A CabinetVendor with this exact name already exists (e.g. created
        // manually via "+ New vendor" before this company existed, or from
        // an import run before the company record was added). Try to adopt
        // it if it's still unlinked; otherwise leave this company unlinked -
        // an admin can link it by hand on the Companies page.
        if (err?.code === "P2002") {
          await prismaAny.cabinetVendor.updateMany({
            where: { name: company.actualName, providerId: null },
            data: { providerId: company.id },
          });
        }
      }
    }

    const vendors = await prismaAny.cabinetVendor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        providerId: true,
        provider: { select: { displayName: true, discount: true, factor: true } },
        catalogPdfUrl: true,
        catalogPdfFileName: true,
        catalogUploadedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      vendors: vendors.map((v: any) => ({
        id: v.id,
        name: v.name,
        // Round 6 follow-up: vendors ARE the cabinet companies from Diego's
        // point of view - when a vendor is linked to a CabinetProviderSettings
        // record, prefer that company's displayName for anything shown to an
        // admin (e.g. the import page's vendor picker). Falls back to the raw
        // catalog vendor name when nothing is linked yet.
        displayName: v.provider ? v.provider.displayName : v.name,
        providerId: v.providerId,
        discount: v.provider ? Number(v.provider.discount) : null,
        factor: v.provider ? Number(v.provider.factor) : null,
        // Round 13: lets the admin import page show whether a reference
        // catalog is already attached, and offer "replace" vs "attach".
        catalogPdfUrl: v.catalogPdfUrl || null,
        catalogPdfFileName: v.catalogPdfFileName || null,
        catalogUploadedAt: v.catalogUploadedAt ? v.catalogUploadedAt.toISOString() : null,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching cabinet vendors:", error);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}
