"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminCommandPalette from "./AdminCommandPalette";
import { ADMIN_NAV_ITEMS } from "./adminNav";

const SIDEBAR_STORAGE_KEY = "bid-admin-sidebar-collapsed";

function navClass(active: boolean, collapsed: boolean): string {
  return [
    "group relative flex items-center rounded-xl px-3 py-2 text-sm transition",
    active
      ? "bg-interactive-primary text-white shadow-[0_8px_24px_rgba(9,137,255,0.35)] before:absolute before:left-1 before:top-1/2 before:h-4 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-white"
      : "text-slate-300 hover:bg-white/10 hover:text-white",
    collapsed ? "justify-center" : "justify-start",
  ].join(" ");
}

export default function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && key === "j") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (!isTypingTarget && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
        event.preventDefault();
        setHelpOpen(true);
      }
      if (key === "escape") {
        setPaletteOpen(false);
        setHelpOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const grouped = useMemo(
    () => ({
      dashboard: ADMIN_NAV_ITEMS.filter((item) => item.section === "dashboard"),
      commerce: ADMIN_NAV_ITEMS.filter((item) => item.section === "commerce"),
      content: ADMIN_NAV_ITEMS.filter((item) => item.section === "content"),
    }),
    [],
  );

  const breadcrumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string; icon: string }[] = [{ label: "後台", href: "/z04urru6", icon: "🏠" }];
    if (parts[0] !== "z04urru6") return crumbs;

    const directMap: Record<string, { label: string; icon: string }> = {
      listings: { label: "開放中商品", icon: "📦" },
      orders: { label: "訂單管理", icon: "🧾" },
      users: { label: "使用者列表", icon: "👤" },
      new: { label: "建立商品", icon: "➕" },
      closed: { label: "已結標結算", icon: "✅" },
      newsletter: { label: "電子報", icon: "✉️" },
      compose: { label: "撰寫新電子報", icon: "📝" },
      homepage: { label: "首頁內容管理", icon: "🏡" },
      "partner-lofts": { label: "合作鴿舍管理", icon: "🕊️" },
      "pigeon-gallery": { label: "鴿展 Gallery", icon: "🕊️" },
      categories: { label: "分類管理", icon: "🗂️" },
      items: { label: "項目管理", icon: "🐦" },
    };

    let runningPath = "";
    parts.forEach((part, index) => {
      runningPath += `/${part}`;
      if (part === "z04urru6") return;

      const navLabel = ADMIN_NAV_ITEMS.find((item) => item.href === runningPath)?.label;
      const mapEntry = directMap[part];
      const numericId = /^\d+$/.test(part) ? `#${part}` : null;
      const label = navLabel ?? mapEntry?.label ?? numericId ?? part;
      const icon = mapEntry?.icon ?? (numericId ? "🔎" : "📄");

      // Skip duplicate of root label.
      if (index === 1 && label === "總覽") return;
      crumbs.push({ label, href: runningPath, icon });
    });

    return crumbs;
  }, [pathname]);

  return (
    <>
      <div className="flex min-h-screen bg-surface-muted text-ink">
        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 flex flex-col bg-header p-3 shadow-2xl transition-[width,transform] duration-300",
            collapsed ? "w-[84px]" : "w-[264px]",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          ].join(" ")}
        >
          <div className="mb-3 flex items-center justify-between px-2 py-2">
            <Link href="/z04urru6" className={["font-semibold tracking-tight text-white", collapsed ? "sr-only" : "text-lg"].join(" ")}>
              Studio BID
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
              aria-label="切換側欄寬度"
            >
              {collapsed ? "→" : "←"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mb-3 flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/15"
          >
            <span className={collapsed ? "sr-only" : "truncate"}>Search</span>
            <span className="rounded-md border border-white/30 px-1.5 py-0.5">⌘J</span>
          </button>

          <nav className="flex-1 space-y-5 overflow-y-auto">
            <div>
              <p className={["px-2 pb-2 text-xs uppercase tracking-wider text-slate-400", collapsed ? "sr-only" : ""].join(" ")}>
                Dashboards
              </p>
              <ul className="space-y-1">
                {grouped.dashboard.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={navClass(active, collapsed)}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className={[collapsed ? "text-xs" : "", "font-medium"].join(" ")}>
                          {collapsed ? item.label.slice(0, 2) : item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className={["px-2 pb-2 text-xs uppercase tracking-wider text-slate-400", collapsed ? "sr-only" : ""].join(" ")}>
                Commerce
              </p>
              <ul className="space-y-1">
                {grouped.commerce.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={navClass(active, collapsed)}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className={[collapsed ? "text-xs" : "", "font-medium"].join(" ")}>
                          {collapsed ? item.label.slice(0, 2) : item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {grouped.content.length > 0 && (
              <div>
                <p className={["px-2 pb-2 text-xs uppercase tracking-wider text-slate-400", collapsed ? "sr-only" : ""].join(" ")}>
                  Content
                </p>
                <ul className="space-y-1">
                  {grouped.content.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={navClass(active, collapsed)}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? "page" : undefined}
                        >
                          <span className={[collapsed ? "text-xs" : "", "font-medium"].join(" ")}>
                            {collapsed ? item.label.slice(0, 2) : item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </nav>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/10 p-3 text-xs text-slate-300">
            <p className="truncate font-medium text-slate-100">{email}</p>
            <p className="mt-1 text-slate-300">Admin session</p>
          </div>
        </aside>

        <div className={[
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding-left] duration-300",
          collapsed ? "lg:pl-[84px]" : "lg:pl-[264px]",
        ].join(" ")}>
          <header className="sticky top-0 z-30 border-b border-border/80 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileOpen((prev) => !prev)}
                  className="rounded-lg border border-border px-2 py-1 text-sm lg:hidden"
                  aria-label="開關側欄"
                >
                  ☰
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="hidden items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-ink-light sm:flex"
                >
                  <span>Search</span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-xs">⌘/Ctrl + J</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="hidden items-center gap-2 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-sm text-ink-light sm:flex"
                  aria-label="開啟快捷鍵說明"
                >
                  <span>?</span>
                </button>

                <div className="min-w-0 md:hidden">
                  <p className="truncate text-xs text-ink-light">
                    {breadcrumbs[breadcrumbs.length - 1]?.icon} {breadcrumbs[breadcrumbs.length - 1]?.label}
                  </p>
                </div>

                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-xs text-ink-light">
                    {breadcrumbs.map((crumb, index) => (
                      <span key={crumb.href}>
                        {index > 0 ? " / " : ""}
                        {index === breadcrumbs.length - 1 ? (
                          <span className="font-semibold text-ink">
                            {crumb.icon} {crumb.label}
                          </span>
                        ) : (
                          <Link href={crumb.href} className="hover:text-interactive-primary">
                            {crumb.icon} {crumb.label}
                          </Link>
                        )}
                      </span>
                    ))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">
                  前台
                </Link>
                <AdminLogoutButton />
              </div>
            </div>
          </header>

          <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>

        {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      </div>

      <AdminCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setHelpOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">快捷鍵說明</h2>
                <p className="mt-1 text-sm text-ink-light">加速管理後台的常用操作。</p>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-md border border-border px-2 py-1 text-sm hover:bg-surface-muted"
              >
                關閉
              </button>
            </div>

            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span>開啟 / 關閉 Command Palette</span>
                <kbd className="rounded border border-border bg-white px-2 py-0.5 text-xs">Ctrl/Cmd + J</kbd>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span>開啟快捷鍵說明</span>
                <kbd className="rounded border border-border bg-white px-2 py-0.5 text-xs">?</kbd>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span>列表導覽</span>
                <kbd className="rounded border border-border bg-white px-2 py-0.5 text-xs">↑ ↓</kbd>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span>快速跳轉</span>
                <kbd className="rounded border border-border bg-white px-2 py-0.5 text-xs">PgUp / PgDn / Home / End</kbd>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span>執行 / 關閉</span>
                <kbd className="rounded border border-border bg-white px-2 py-0.5 text-xs">Enter / Esc</kbd>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}