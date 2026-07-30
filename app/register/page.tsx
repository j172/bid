"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "../components/Button";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, phone, address }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "註冊失敗");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold">註冊</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            密碼（至少 8 個字元）
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
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
          {error && <p className="text-sm text-ended">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "註冊中..." : "註冊"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-ink-light">
          已經有帳號？{" "}
          <Link href="/login" className="font-medium text-gold hover:underline">
            登入
          </Link>
        </p>
      </div>
    </main>
  );
}
