import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import AccessoriesClient from "./AccessoriesClient";

export default async function AccessoriesPage() {
  const { user, isActive, canAccess } =
    await getProgramUserContext("accessories");

  if (!user || !isActive) {
    redirect("/login");
  }

  // Access is managed in Settings → Program Access
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <AccessoriesClient canEdit={canAccess} userId={user.id} />;
}
