"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "../../../components/Button";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        標題
        <input name="title" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        描述
        <textarea name="description" required rows={5} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        起標價
        <input name="startingPrice" type="number" min={1} step={1} required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        買斷價（選填，若填寫必須大於起標價；留空則此商品不提供一鍵買斷）
        <input name="buyItNowPrice" type="number" min={1} step={1} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        結標時間
        <input name="endsAt" type="datetime-local" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        商品照片（至少一張）
        <input
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          required
          className="w-full text-sm"
        />
      </label>
      {error && <p className="text-sm text-ended">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "建立中..." : "建立商品"}
      </Button>
    </form>
  );
}
