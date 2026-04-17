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
  title: "Customers - GM Design Portal",
  description: "Unified client & contractor directory powered by Pipedrive",
};

export default async function CustomersV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/customers-v2");
  }

  const { appRole, isActive } = await getCurrentUserWithRole();

  if (!isActive) {
    redirect("/auth/status?reason=inactive");
  }

  if (appRole === "unassigned") {
    redirect("/auth/status?reason=unassigned");
  }

  const program = programs.find((p) => p.id === "customersV2")!;
  const hasAccess = userCanAccessProgram(program, appRole, isActive);

  if (!hasAccess) {
    redirect("/dashboard");
  }

  const user = session?.user ?? null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 w-full">
        <AppSidebar userRole={appRole} />
        <div className="flex-1 flex flex-col min-w-0">
          <NavbarClient user={user} />
          <main className="p-6 overflow-auto min-w-0 bg-gray-50 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
