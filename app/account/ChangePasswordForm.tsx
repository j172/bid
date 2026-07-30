"use client";

import { useState } from "react";
import Button from "../components/Button";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none";

export default function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "修改密碼失敗");
      return;
    }
    setOldPassword("");
    setNewPassword("");
    setNotice("密碼已更新");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        舊密碼
        <input
          type="password"
          required
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        新密碼（至少 8 個字元）
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "更新中..." : "修改密碼"}
        </Button>
        {error && <span className="text-sm text-ended">{error}</span>}
        {notice && <span className="text-sm text-leading">{notice}</span>}
      </div>
    </form>
  );
}
