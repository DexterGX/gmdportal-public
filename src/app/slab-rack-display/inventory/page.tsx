import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import InventoryClient from "../ui/InventoryClient";

export default async function SlabInventoryPage() {
  const session = await getServerSession(authOptions);
  const userName =
    session?.user?.name || session?.user?.email || "Unknown User";
  return <InventoryClient userName={userName} />;
}
