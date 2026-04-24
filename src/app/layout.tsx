// src/app/layout.tsx
import "@/styles/globals.css";
import React from "react";

export const metadata = {
  title: "Dashboard",
  description: "GM Design Portal",
  icons: {
    icon: "/logo_GM.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
       <body className="min-h-screen w-full" suppressHydrationWarning>
         {children}
       </body>
    </html>
  );
}
