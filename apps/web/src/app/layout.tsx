import type { Metadata } from "next";
import "./globals.css";
import { CookieConsent } from "@/components/claimforge-workspace/CookieConsent";

export const metadata: Metadata = {
  title: "ProductVault — Warranty, with a way forward",
  description:
    "Organize your warranty evidence, understand the written terms, and prepare your next step.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dark" suppressHydrationWarning>{children}<CookieConsent /></body>
    </html>
  );
}
