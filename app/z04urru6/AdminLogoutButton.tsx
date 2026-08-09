"use client";

import { useRouter } from "next/navigation";

// Untranslated copy of the public LogoutButton (app/[locale]/components/
// LogoutButton.tsx). The admin backend is deliberately out of scope for i18n
// (see the ticket that introduced app/[locale]/), and admin pages sit outside
// the next-intl-wrapped route tree entirely, so a shared/translated component
// can't safely be rendered here anyway (no NextIntlClientProvider in scope) —
// hence this separate copy.
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
