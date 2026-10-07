import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import SinkBrandSettingsTable from "../../components/SinkBrandSettingsTable";

export default async function SinkBrandSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/sinksPriceList/admin/brands");
  }

  const { appRole } = await getProgramUserContext("sinks");
  if (appRole !== "admin") {
    redirect("/sinksPriceList");
  }

  const prismaAny = prisma as any;
  const brands = await prismaAny.sinkBrand.findMany({
    orderBy: { name: "asc" },
  });

  const transformed = brands.map((brand: any, index: number) => ({
    id: brand.id,
    brandNumber: index + 1,
    name: brand.name,
    logoUrl: brand.logoUrl,
    factor: Number(brand.factor),
    taxFactor: Number(brand.taxFactor),
    freight: Number(brand.freight),
    discount: Number(brand.discount),
    contactName: brand.contactName,
    contactCell: brand.contactCell,
    contactPhone: brand.contactPhone,
    contactEmail: brand.contactEmail,
    createdAt: String(brand.createdAt),
    updatedAt: String(brand.updatedAt),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Brand Settings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure pricing factors and contacts for sink brands.
        </p>
      </div>

      <SinkBrandSettingsTable initialData={transformed} />
    </div>
  );
}
