import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MiscEstimatesClient from "./MiscEstimatesClient";

const prismaAny = prisma as any;

export default async function MiscEstimatesPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!["admin", "sales", "office"].includes(appRole)) {
    redirect("/dashboard");
  }

  const companySettings = await prismaAny.companyDocumentSettings.findFirst();

  return (
    <MiscEstimatesClient
      initialCompanyInfo={{
        companyName: companySettings?.companyName ?? "GM Design",
        phoneNumber: companySettings?.phoneNumber ?? null,
        address: companySettings?.address ?? null,
        logoUrl: companySettings?.logoUrl ?? "/logo.svg",
      }}
      initialSalesRep={user.name || ""}
    />
  );
}
