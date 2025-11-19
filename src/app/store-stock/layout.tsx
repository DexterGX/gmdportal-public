import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/organisms/Sidebar/Sidebar";
import NavbarClient from "@/components/organisms/Navbar/NavbarClient";
import { SidebarProvider } from "@/context/SidebarContext";
import { getCurrentUserRole } from "@/lib/authHelpers";
import { programs, userHasAccessToProgram } from "@/lib/programsConfig";

export default async function StoreStockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/store-stock");
  }

  // Check role-based access
  const role = await getCurrentUserRole();
  const program = programs.find((p) => p.id === "storeStock")!;
  const hasAccess = userHasAccessToProgram(program, role);

  if (!hasAccess) {
    redirect("/dashboard");
  }

  const user = session?.user ?? null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 w-full">
        <AppSidebar />
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
