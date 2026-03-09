import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import SlabRackDisplayClient from "./ui/SlabRackDisplayClient";

export const metadata = {
  title: "SlabBay",
};

export default async function SlabRackDisplayPage() {
  const session = await getServerSession(authOptions);
  const userName =
    session?.user?.name || session?.user?.email || "Unknown User";
  return <SlabRackDisplayClient userName={userName} />;
}
