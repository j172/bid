import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import AdminShell from "./AdminShell";
import "../globals.css";

// The admin backend is a second, independent root layout (its own <html>/
// <body>) — see app/[locale]/layout.tsx for the public site's root. There's
// deliberately no shared top-level app/layout.tsx: this tree stays entirely
// outside next-intl's routing (see middleware.ts's matcher) and untranslated.
export const metadata: Metadata = {
  title: "後台管理",
  description: "拍賣競標網站後台管理",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <html lang="zh-Hant">
      <body className="min-h-screen font-sans text-ink">
        <AdminShell email={user.email}>{children}</AdminShell>
      </body>
    </html>
  );
}
