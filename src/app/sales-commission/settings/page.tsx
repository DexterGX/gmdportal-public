import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import SalesCommissionSettingsClient from "./SalesCommissionSettingsClient";

const p = prisma as any;

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!session || !user || !isActive || appRole === "unassigned")
    redirect("/login");

  const settings = await p.cMSSettings.findFirst();
  return (
    <SalesCommissionSettingsClient
      settings={JSON.parse(JSON.stringify(settings))}
    />
  );
}
