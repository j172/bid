"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "登入失敗");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 400, margin: "0 auto" }}>
      <h1>登入</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label>
          密碼
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "登入中..." : "登入"}
        </button>
      </form>
      <p>
        還沒有帳號？<a href="/register">註冊</a>
      </p>
    </main>
  );
}
