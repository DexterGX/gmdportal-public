import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";

export default async function HomePage() {
  // Server-side: if the user has a session, send them to the dashboard;
  // otherwise send them to the login page.
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }
  redirect("/login");
}
