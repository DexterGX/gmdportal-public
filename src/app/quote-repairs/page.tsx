import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getSalesAssignableUsers } from "@/lib/users";
import QuoteRepairsClient from "./QuoteRepairsClient";

export default async function QuoteRepairsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!["admin", "sales", "office", "finance"].includes(appRole)) {
    redirect("/dashboard");
  }

  const salesUsers = await getSalesAssignableUsers();

  return (
    <QuoteRepairsClient
      userId={user.id}
      userRole={appRole}
      userName={user.name || user.email || "User"}
      salesUsers={salesUsers.map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
      }))}
    />
  );
}
