import { getProgramUserContext } from "@/lib/programPermissions";
import { redirect } from "next/navigation";
import RackSettingsClient from "../ui/RackSettingsClient";

export const metadata = {
  title: "SlabBay Rack Settings",
};

export default async function RackSettingsPage() {
  const { appRole } = await getProgramUserContext("slabRack");
  if (appRole !== "admin") {
    redirect("/dashboard");
  }

  return <RackSettingsClient />;
}
