import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { getSalesAssignableUsers } from "@/lib/users";
import QuoteRepairsClient from "./QuoteRepairsClient";

export default async function QuoteRepairsPage() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("quoteRepairs");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canAccess) {
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
