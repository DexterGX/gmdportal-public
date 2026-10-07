import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import SalesCommissionSettingsClient from "./SalesCommissionSettingsClient";

const p = prisma as any;

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const { user, isActive, appRoles } = await getProgramUserContext("salesCommission");
  if (!session || !user || !isActive || appRoles.length === 0)
    redirect("/login");

  const settings = await p.cMSSettings.findFirst();
  return (
    <SalesCommissionSettingsClient
      settings={JSON.parse(JSON.stringify(settings))}
    />
  );
}
