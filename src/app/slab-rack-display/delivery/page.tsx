import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SlabDeliveryClient from "./SlabDeliveryClient";

export const metadata = {
  title: "Slab Delivery",
};

export default async function SlabDeliveryPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/slab-rack-display/delivery");
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin" && appRole !== "office") {
    redirect("/slab-rack-display");
  }

  const userName = session.user?.name || session.user?.email || "Unknown User";

  return <SlabDeliveryClient userName={userName} />;
}
