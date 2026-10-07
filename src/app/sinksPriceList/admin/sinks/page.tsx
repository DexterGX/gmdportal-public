import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import SinksDataTable from "../../components/SinksDataTable";

export default async function SinksDataPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/sinksPriceList/admin/sinks");
  }

  const { appRole } = await getProgramUserContext("sinks");
  if (appRole !== "admin") {
    redirect("/sinksPriceList");
  }

  const prismaAny = prisma as any;
  const [rows, brands] = await Promise.all([
    prismaAny.sink.findMany({
      include: { brand: { select: { id: true, name: true } } },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prismaAny.sinkBrand.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const transformedRows = rows.map((row: any) => ({
    id: row.id,
    brandId: row.brandId,
    brandName: row.brand?.name || "",
    series: row.series,
    model: row.model,
    description: row.description,
    dimensions: row.dimensions,
    listedPrice: Number(row.listedPrice),
    finalPrice: Number(row.finalPrice),
    status: row.status,
    isPromotional: Boolean(row.isPromotional),
    promotionalPrice:
      row.promotionalPrice !== null && row.promotionalPrice !== undefined
        ? Number(row.promotionalPrice)
        : null,
    imageUrl: row.imageUrl,
    updatedAt: String(row.updatedAt),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Sinks Data
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          View and manage sink records and prices.
        </p>
      </div>

      <SinksDataTable initialRows={transformedRows} brands={brands} />
    </div>
  );
}
