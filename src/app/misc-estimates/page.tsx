import { getProgramUserContext } from "@/lib/programPermissions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MiscEstimatesClient from "./MiscEstimatesClient";

const prismaAny = prisma as any;

export default async function MiscEstimatesPage() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("miscEstimates");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canAccess) {
    redirect("/dashboard");
  }

  const companySettings = await prismaAny.companyDocumentSettings.findFirst();

  return (
    <MiscEstimatesClient
      initialCompanyInfo={{
        companyName: companySettings?.companyName ?? "GM Design",
        phoneNumber: companySettings?.phoneNumber ?? null,
        email: companySettings?.email ?? null,
        website: companySettings?.website ?? null,
        address: companySettings?.address ?? null,
        logoUrl: companySettings?.logoUrl ?? "/logo.svg",
      }}
      initialSalesRep={user.name || ""}
    />
  );
}
