import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import CabinetEstimateForm from "./CabinetEstimateForm";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function NewCabinetEstimatePage() {
  const { user, isActive, appRoles } = await getProgramUserContext("cabinetEstimates");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  const [companySettings, specialCustomizationItems] = await Promise.all([
    prismaAny.companyDocumentSettings.findFirst(),
    prismaAny.cabinetSpecialCustomizationItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <CabinetEstimateForm
      currentUserName={user.name || user.email || ""}
      companyName={companySettings?.companyName || "GM Design"}
      companyLogoUrl={companySettings?.logoUrl || "/logo.svg"}
      companyPhone={companySettings?.phoneNumber || null}
      companyAddress={companySettings?.address || null}
      specialCustomizationItems={specialCustomizationItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: toNumber(item.price),
      }))}
    />
  );
}
