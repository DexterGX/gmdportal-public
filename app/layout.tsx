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
      {/* Use min-h-screen and ensure full width so flex children can size responsively */}
      <body className="min-h-screen flex w-full">{children}</body>
    </html>
  );
}
