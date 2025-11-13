"use client";
import React from "react";
import { Sidebar, NavbarClient } from "@/components/organisms";
import { SidebarProvider } from "@/context/SidebarContext";

type Props = {
  children: React.ReactNode;
};

export default function DashboardLayoutTemplate({ children }: Props) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1">
          <NavbarClient user={null} />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
