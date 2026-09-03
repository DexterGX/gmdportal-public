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

  // Round 6 added discount/factor (Prisma Decimal) to this model - a Server
  // Component can't pass a Decimal instance as a prop to a Client Component,
  // so convert to plain numbers even though this page's client doesn't
  // display them (it still receives them as part of each provider record).
  const serializedProviders = providers.map((p: any) => ({
    ...p,
    discount: Number(p.discount),
    factor: Number(p.factor),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return <CabinetsInfoClient initialProviders={serializedProviders} />;
}
