import { getProgramUserContext } from "@/lib/programPermissions";
import { redirect } from "next/navigation";
import BrandSettingsClient from "../../ui/BrandSettingsClient";

export const metadata = {
  title: "SlabBay Brand Settings",
};

export default async function SlabBayBrandSettingsPage() {
  const { appRole } = await getProgramUserContext("slabRack");
  if (appRole !== "admin") {
    redirect("/dashboard");
  }

  return <BrandSettingsClient />;
}
