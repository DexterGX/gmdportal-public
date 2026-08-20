import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { redirect } from "next/navigation";
import BrandSettingsClient from "../../ui/BrandSettingsClient";

export const metadata = {
  title: "SlabBay Brand Settings",
};

export default async function SlabBayBrandSettingsPage() {
  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    redirect("/dashboard");
  }

  return <BrandSettingsClient />;
}
