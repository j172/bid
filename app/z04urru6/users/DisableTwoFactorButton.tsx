"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisableTwoFactorButton({ userId, email }: { userId: number; email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (!confirm(`確定要關閉 ${email} 的兩階段驗證嗎？關閉後該使用者登入時將不再需要輸入驗證碼。`)) return;
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/users/${userId}/disable-two-factor`, { method: "POST" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "操作失敗");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "處理中..." : "關閉兩階段驗證"}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
    </div>
  );
}
