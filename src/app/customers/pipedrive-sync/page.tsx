import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import PipedriveSyncClient from "./PipedriveSyncClient";

export const metadata = {
  title: "Pipedrive Sync | GM Design Portal",
  description: "Sync deals from Pipedrive to create prospect records",
};

export default async function PipedriveSyncPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { appRole } = await getCurrentUserWithRole();

  if (appRole !== "admin") {
    redirect("/dashboard");
  }

  return <PipedriveSyncClient />;
}
