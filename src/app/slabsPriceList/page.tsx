import { getServerSession } from "next-auth";
import authOptions from "../../lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "../../../components/Sidebar";
import NavbarClient from "../../../components/NavbarClient";
import { SidebarProvider } from "../../context/SidebarContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // (debug logging removed)
  const session = await getServerSession(authOptions);
  if (!session) {
    // redirect to next-auth sign in (keeps callback to dashboard)
    redirect("/api/auth/signin?callbackUrl=/dashboard");
  }

  const user = session?.user ?? null;

  // Render full dashboard layout with Sidebar and Navbar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-gray-100 dark:bg-neutral-900 w-full">
        <AppSidebar />
        {/* Ensure the main flex column can shrink: min-w-0 allows children (like responsive charts) to measure correctly */}
        <div className="flex-1 flex flex-col min-w-0">
          <NavbarClient user={user} />
          <main className="p-6 overflow-auto min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
