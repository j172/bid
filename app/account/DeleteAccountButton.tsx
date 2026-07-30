"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    if (!confirm("確定要刪除帳戶嗎？此動作無法撤銷。")) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/account/delete", { method: "POST" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "刪除失敗");
      return;
    }
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
        {submitting ? "處理中..." : "刪除帳戶"}
      </button>
      {error && <span className="text-sm text-ended">{error}</span>}
    </div>
  );
}
