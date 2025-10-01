// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Dashboard",
  description: "GM Design Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen w-screen overflow-hidden">{children}</body>
    </html>
  );
}
