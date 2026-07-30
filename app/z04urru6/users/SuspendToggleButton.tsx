"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SuspendToggleButton({
  userId,
  isSuspended,
  isSelf,
}: {
  userId: number;
  isSuspended: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Suspending yourself is always rejected server-side — hide the action
  // entirely rather than let an admin click into a guaranteed error.
  if (isSelf && !isSuspended) {
    return <span className="text-xs text-ink-light">（本人）</span>;
  }

  const label = isSuspended ? "解除停權" : "停權";
  const confirmMessage = isSuspended
    ? "確定要解除這個帳號的停權嗎？"
    : "確定要停權這個帳號嗎？此帳號將立即無法登入。";

  async function handleToggle() {
    if (!confirm(confirmMessage)) return;
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/users/${userId}/${isSuspended ? "unsuspend" : "suspend"}`, {
      method: "POST",
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
        className={`rounded-md border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
          isSuspended
            ? "border-leading text-leading hover:bg-leading-bg"
            : "border-ended text-ended hover:bg-ended-bg"
        }`}
      >
        {submitting ? "處理中..." : label}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
    </div>
  );
}
