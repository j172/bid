"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "../components/Button";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none";

export default function ProfileForm({
  initialDisplayName,
  initialPhone,
  initialAddress,
}: {
  initialDisplayName: string;
  initialPhone: string;
  initialAddress: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, phone, address }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "更新失敗");
      return;
    }
    setNotice("已更新");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        顯示名稱
        <input
          type="text"
          required
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        聯絡電話（僅數字、- 和空格，7-15 碼）
        <input
          type="tel"
          required
          maxLength={20}
          pattern="[0-9\- ]{7,20}"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        地址
        <input
          type="text"
          required
          maxLength={200}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "儲存中..." : "儲存個人資料"}
        </Button>
        {error && <span className="text-sm text-ended">{error}</span>}
        {notice && <span className="text-sm text-leading">{notice}</span>}
      </div>
    </form>
  );
}
