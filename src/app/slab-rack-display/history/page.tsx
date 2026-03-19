import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import HistoryClient from "../ui/HistoryClient";

export const metadata = {
  title: "SlabBay History",
};

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  const userName =
    session?.user?.name || session?.user?.email || "Unknown User";

  return <HistoryClient userName={userName} />;
}
