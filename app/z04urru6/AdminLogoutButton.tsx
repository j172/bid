"use client";

import { useRouter } from "next/navigation";

// Untranslated copy of the public LogoutButton — see AdminSiteHeader's
// comment for why the admin backend keeps its own separate copies rather
// than sharing components with the translated public site.
export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-border bg-white px-3 py-1.5 text-sm hover:bg-surface-muted"
    >
      登出
    </button>
  );
}
