import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteHeader from "./components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "拍賣競標網站",
  description: "單一賣家英式拍賣競標網站",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen font-sans text-ink">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
