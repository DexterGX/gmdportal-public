import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { canManageQuoteRepairSettings } from "@/lib/quoteRepairs";
import { prisma } from "@/lib/prisma";
import QuoteRepairSettingsClient from "./QuoteRepairSettingsClient";

export default async function QuoteRepairSettingsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("quoteRepairs");
  if (!user || !isActive || appRoles.length === 0) redirect("/login");
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
