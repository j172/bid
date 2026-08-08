"use client";

import { useState } from "react";

export default function ResetPasswordButton({ userId, email }: { userId: number; email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (!confirm(`確定要寄送重設密碼信到 ${email} 嗎？使用者需自行透過信件連結設定新密碼。`)) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "操作失敗");
      return;
    }
    setSuccess(`已寄出重設密碼信至 ${data.email ?? email}`);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "處理中..." : "重置密碼"}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
      {success && <span className="text-xs text-leading">{success}</span>}
    </div>
  );
}
