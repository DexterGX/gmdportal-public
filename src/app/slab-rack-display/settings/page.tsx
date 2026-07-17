import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { redirect } from "next/navigation";
import RackSettingsClient from "../ui/RackSettingsClient";

export const metadata = {
  title: "SlabBay Rack Settings",
};

export default async function RackSettingsPage() {
  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    redirect("/dashboard");
  }

  return <RackSettingsClient />;
}
