import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import CabinetCompaniesClient from "./CabinetCompaniesClient";

const prismaAny = prisma as any;

export default async function CabinetCompaniesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/cabinet-estimates/companies");
  }

  const { appRole } = await getProgramUserContext("cabinetEstimates");
  if (appRole !== "admin") {
    redirect("/cabinet-estimates");
  }

  const providers = await prismaAny.cabinetProviderSettings.findMany({
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    include: {
      cabinetVendor: { select: { id: true, name: true } },
    },
  });

  // Server Components can't pass Prisma Decimal instances to a Client
  // Component as props (React Flight serialization rejects them, unlike
  // NextResponse.json() which uses Decimal's toJSON()) - convert to plain
  // numbers here before handing off to CabinetCompaniesClient.
  const serializedProviders = providers.map((p: any) => ({
    ...p,
    discount: Number(p.discount),
    factor: Number(p.factor),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return <CabinetCompaniesClient initialProviders={serializedProviders} />;
}
