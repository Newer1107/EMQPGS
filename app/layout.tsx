import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: `${APP_NAME} - Examination Management & Question Paper Generation`,
  description: "Examination Management and Question Paper Generation System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
