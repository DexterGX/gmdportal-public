import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { canManageQuoteRepairSettings } from "@/lib/quoteRepairs";
import { prisma } from "@/lib/prisma";
import QuoteRepairSettingsClient from "./QuoteRepairSettingsClient";

export default async function QuoteRepairSettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") redirect("/login");
  if (!canManageQuoteRepairSettings(appRole)) redirect("/quote-repairs");
  let settings = await prisma.quoteRepairSettings.findFirst();
  if (!settings) settings = await prisma.quoteRepairSettings.create({ data: {} });
  const services = await prisma.quoteRepairService.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <QuoteRepairSettingsClient
      initialSettings={JSON.parse(JSON.stringify(settings))}
      initialServices={JSON.parse(JSON.stringify(services))}
    />
  );
}
