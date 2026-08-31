import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import CabinetEstimateForm from "./CabinetEstimateForm";

const prismaAny = prisma as any;

export default async function NewCabinetEstimatePage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  const companySettings = await prismaAny.companyDocumentSettings.findFirst();

  return (
    <CabinetEstimateForm
      currentUserName={user.name || user.email || ""}
      companyName={companySettings?.companyName || "GM Design"}
      companyLogoUrl={companySettings?.logoUrl || "/logo.svg"}
      companyPhone={companySettings?.phoneNumber || null}
      companyAddress={companySettings?.address || null}
    />
  );
}
