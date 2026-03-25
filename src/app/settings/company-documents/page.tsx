import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import CompanyDocumentSettingsClient from "./CompanyDocumentSettingsClient";

const prismaAny = prisma as any;

export default async function CompanyDocumentsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/settings/company-documents");
  }

  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") {
    redirect("/settings");
  }

  let settings = await prismaAny.companyDocumentSettings.findFirst();
  if (!settings) {
    settings = await prismaAny.companyDocumentSettings.create({
      data: {
        companyName: "GM Design",
        phoneNumber: "(305) XXX-XXXX",
        logoUrl: "/logo.svg",
      },
    });
  }

  return (
    <CompanyDocumentSettingsClient
      initialSettings={{
        id: settings.id,
        companyName: settings.companyName,
        phoneNumber: settings.phoneNumber,
        address: settings.address,
        logoUrl: settings.logoUrl,
        updatedAt: settings.updatedAt.toISOString(),
      }}
    />
  );
}
