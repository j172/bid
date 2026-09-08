"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("nav");

  async function handleLogout() {
    try {
      window.google?.accounts?.id?.disableAutoSelect();
    } catch {
      // Ignore if GSI is not loaded
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary"
    >
      {t("logout")}
    </button>
  );
}
