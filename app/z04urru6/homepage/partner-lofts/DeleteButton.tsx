"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    if (!confirm(`確定要刪除「${title}」這筆合作鴿舍資料嗎？此動作無法撤銷。`)) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/homepage-sections/${id}`, { method: "DELETE" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "刪除失敗");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={submitting}
        className="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "處理中..." : "刪除"}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
    </div>
  );
}
