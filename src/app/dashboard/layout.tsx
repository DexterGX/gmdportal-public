import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/organisms/Sidebar/Sidebar";
import NavbarClient from "@/components/organisms/Navbar/NavbarClient";
import { SidebarProvider } from "@/context/SidebarContext";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/dashboard");
  }

  // Check if user is inactive or unassigned
  const { appRole, isActive } = await getCurrentUserWithRole();

  if (!isActive) {
    redirect("/auth/status?reason=inactive");
  }

  if (appRole === "unassigned") {
    redirect("/auth/status?reason=unassigned");
  }

  const user = session?.user ?? null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-gray-100 dark:bg-neutral-900 w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <NavbarClient user={user} />
          <main className="p-6 overflow-auto min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
