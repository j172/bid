"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewListingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/listings", { method: "POST", body: formData });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "建立失敗");
      return;
    }
    router.push(`/listings/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label>
        標題
        <input name="title" required style={{ width: "100%" }} />
      </label>
      <label>
        描述
        <textarea name="description" required rows={5} style={{ width: "100%" }} />
      </label>
      <label>
        起標價
        <input name="startingPrice" type="number" min={1} step={1} required style={{ width: "100%" }} />
      </label>
      <label>
        買斷價（必須大於起標價）
        <input name="buyItNowPrice" type="number" min={1} step={1} required style={{ width: "100%" }} />
      </label>
      <label>
        結標時間
        <input name="endsAt" type="datetime-local" required style={{ width: "100%" }} />
      </label>
      <label>
        商品照片（至少一張）
        <input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required />
      </label>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "建立中..." : "建立商品"}
      </button>
    </form>
  );
}
