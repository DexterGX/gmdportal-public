import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { getInstallers } from "@/lib/users";
import EstimateSettingsClient from "./EstimateSettingsClient";

export default async function EstimateSettingsPage() {
  const { user, appRole, isActive } = await getProgramUserContext("closetJobs");

  if (!user || !isActive || appRole !== "admin") {
    redirect("/closet-jobs");
  }

  // Fetch installers using shared helper
  const installers = await getInstallers();

  // Get or create settings
  let settings = await prisma.closetEstimateSettings.findFirst();
  if (!settings) {
    settings = await prisma.closetEstimateSettings.create({
      data: {
        defaultGmFactor: 1.35,
        quoteNumberFormat: "{INITIALS}-CQUO-{YYMMDD}-{SEQ3}",
      },
    });
  }

  // Serialize data
  const installersData = installers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
  }));

  const settingsData = {
    defaultGmFactor: settings.defaultGmFactor.toString(),
    quoteNumberFormat: settings.quoteNumberFormat,
  };

  return (
    <EstimateSettingsClient
      installers={installersData}
      settings={settingsData}
    />
  );
}
