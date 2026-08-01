import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import AdminSiteHeader from "./AdminSiteHeader";
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

const navLinkClass = "block rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <html lang="zh-Hant">
      <body className="min-h-screen font-sans text-ink">
        <AdminSiteHeader />
        <div className="mx-auto flex max-w-6xl gap-8 px-4 py-10 sm:px-6">
          <aside className="w-48 flex-shrink-0 rounded-lg bg-header p-3">
            <nav className="flex flex-col gap-1">
              <Link href="/z04urru6" className={navLinkClass}>
                總覽
              </Link>
              <Link href="/z04urru6/listings" className={navLinkClass}>
                開放中商品
              </Link>
              <Link href="/z04urru6/listings/new" className={navLinkClass}>
                建立商品
              </Link>
              <Link href="/z04urru6/listings/closed" className={navLinkClass}>
                已結標結算
              </Link>
              <Link href="/z04urru6/orders" className={navLinkClass}>
                訂單管理
              </Link>
              <Link href="/z04urru6/users" className={navLinkClass}>
                使用者列表
              </Link>
            </nav>
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
