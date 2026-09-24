import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import ApiKeysClient from "./ApiKeysClient";

export default async function ApiKeysPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/settings/api-keys");
  }

  // API keys expose company data to outside programs — admins only, even if
  // Program Access opens Settings to other roles.
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") {
    redirect("/settings");
  }

  return <ApiKeysClient />;
}
