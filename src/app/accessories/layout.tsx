import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/organisms/Sidebar/Sidebar";
import NavbarClient from "@/components/organisms/Navbar/NavbarClient";
import { SidebarProvider } from "@/context/SidebarContext";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { programs, userCanAccessProgram } from "@/lib/programsConfig";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessories Tracker - GM Design Portal",
  description: "Track accessory purchases for cabinet and countertop jobs",
};

export default async function AccessoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/accessories");
  }

  const { appRole, isActive } = await getCurrentUserWithRole();

  if (!isActive) {
    redirect("/auth/status?reason=inactive");
  }

  if (appRole === "unassigned") {
    redirect("/auth/status?reason=unassigned");
  }

  // Check role-based access
  const program = programs.find((p) => p.id === "accessories")!;
  const hasAccess = userCanAccessProgram(program, appRole, isActive);

  if (!hasAccess) {
    redirect("/dashboard");
  }

  const user = session?.user ?? null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 w-full">
        {/* Sidebar - hidden on print */}
        <div className="sticky top-0 h-screen print:hidden">
          <AppSidebar userRole={appRole} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {/* Navbar - hidden on print */}
          <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 print:hidden">
            <NavbarClient user={user} />
          </div>
          <main className="p-6 overflow-auto min-w-0 bg-gray-50 dark:bg-gray-900 print:p-0 print:overflow-visible print:bg-white">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
