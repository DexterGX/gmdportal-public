import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/organisms/Sidebar/Sidebar";
import NavbarClient from "@/components/organisms/Navbar/NavbarClient";
import { SidebarProvider } from "@/context/SidebarContext";
import { getProgramUserContext } from "@/lib/programPermissions";
import {
  canAccessProgramId,
  getAccessibleProgramIds,
} from "@/lib/programAccess";

export default async function SalesCommissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/sales-commission");
  }

  const { appRole, appRoles, isActive } = await getProgramUserContext("salesCommission");

  if (!isActive) {
    redirect("/auth/status?reason=inactive");
  }

  if (appRoles.length === 0) {
    redirect("/auth/status?reason=unassigned");
  }

  const hasAccess = await canAccessProgramId(
    "salesCommission",
    appRoles,
    isActive,
  );
  const accessibleProgramIds = await getAccessibleProgramIds(
    appRoles,
    isActive,
  );

  if (!hasAccess) {
    redirect("/dashboard");
  }

  const user = session?.user ?? null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 w-full">
        <div className="print:hidden">
          <AppSidebar userRole={appRole} userRoles={appRoles} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="print:hidden">
            <NavbarClient
              user={user}
              accessibleProgramIds={accessibleProgramIds}
            />
          </div>
          <main className="p-6 overflow-x-auto min-w-0 bg-gray-50 dark:bg-gray-900 print:p-0 print:overflow-visible print:bg-white">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
