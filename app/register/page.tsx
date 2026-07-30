"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 400, margin: "0 auto" }}>
      <h1>註冊</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label>
          密碼（至少 8 個字元）
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "註冊中..." : "註冊"}
        </button>
      </form>
      <p>
        已經有帳號？<a href="/login">登入</a>
      </p>
    </main>
  );
}
