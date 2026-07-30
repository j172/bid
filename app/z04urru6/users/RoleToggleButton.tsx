"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RoleToggleButton({
  userId,
  currentRole,
  isSelf,
}: {
  userId: number;
  currentRole: "admin" | "user";
  isSelf: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Demoting yourself is always rejected server-side — hide the action
  // entirely rather than let an admin click into a guaranteed error.
  if (isSelf && currentRole === "admin") {
    return <span className="text-xs text-ink-light">（本人）</span>;
  }

  const nextRole = currentRole === "admin" ? "user" : "admin";
  const label = currentRole === "admin" ? "降級為一般使用者" : "升級為管理員";
  const confirmMessage =
    currentRole === "admin" ? "確定要將這個管理員降級為一般使用者嗎？" : "確定要將這個使用者升級為管理員嗎？";

  async function handleToggle() {
    if (!confirm(confirmMessage)) return;
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
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
        onClick={handleToggle}
        disabled={submitting}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "處理中..." : label}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
    </div>
  );
}
