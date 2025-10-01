// app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import authOptions from "../../lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/dashboard");
  }
  const user = session.user;
}
