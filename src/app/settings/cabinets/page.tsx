import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import CabinetsInfoClient from "./CabinetsInfoClient";

const prismaAny = prisma as any;

export default async function CabinetsInfoPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/settings/cabinets");
  }

  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") {
    redirect("/settings");
  }

  const providers = await prismaAny.cabinetProviderSettings.findMany({
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
  });

  return <CabinetsInfoClient initialProviders={providers} />;
}
