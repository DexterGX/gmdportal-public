import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import RackDetailClient from "../ui/RackDetailClient";

export const metadata = {
  title: "Rack Details - SlabBay",
};

export default async function RackDetailPage() {
  const session = await getServerSession(authOptions);
  const userName =
    session?.user?.name || session?.user?.email || "Unknown User";
  return <RackDetailClient userName={userName} />;
}
