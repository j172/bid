"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { usePostJson } from "@/lib/usePostJson";

export default function DeleteAccountButton() {
  const router = useRouter();
  const t = useTranslations("deleteAccountButton");
  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleDelete() {
    if (!confirm(t("confirm"))) {
      return;
    }

    const data = await post("/api/account/delete");
    if (!data) return;

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={submitting}
        className="rounded-md border border-ended px-4 py-2 font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("button")}
      </button>
      {error && <span className="text-sm text-ended">{error}</span>}
    </div>
  );
}
