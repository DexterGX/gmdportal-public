import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { getCabinetEstimateParameters } from "@/lib/cabinetEstimateParameters";
import GmdParametersClient from "./GmdParametersClient";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function GmdParametersPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/cabinet-estimates/parameters");
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    redirect("/cabinet-estimates");
  }

  // getCabinetEstimateParameters already returns plain numbers (not Prisma
  // Decimal instances), so this is safe to hand straight to the Client
  // Component - see the round-6 Decimal-serialization lesson in project
  // memory for why that distinction matters here.
  const initialParameters = await getCabinetEstimateParameters(prismaAny);

  // Round 11 follow-up: Special Customization Settings moved in here from
  // its own standalone admin page (/cabinet-estimates/settings, now
  // removed) - fetched the same way that page used to fetch it.
  const specialCustomizationItems = await prismaAny.cabinetSpecialCustomizationItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <GmdParametersClient
      initialParameters={initialParameters}
      initialSpecialCustomizationItems={specialCustomizationItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: toNumber(item.price),
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      }))}
    />
  );
}
