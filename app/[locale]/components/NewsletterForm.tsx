"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Status = "idle" | "loading" | "success" | "error";

export default function NewsletterForm() {
  const t = useTranslations("footer");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!email.includes("@")) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    const res = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);

    if (res?.ok) {
      setStatus("success");
      setEmail("");
    } else {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mt-4 flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder={t("newsletterPlaceholder")}
          required
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="whitespace-nowrap rounded-md bg-interactive-primary px-3 py-2 text-sm font-semibold text-white hover:bg-interactive-primary-active disabled:opacity-60"
        >
          {status === "loading" ? t("newsletterSubscribing") : t("subscribe")}
        </button>
      </div>
      {status === "success" && <p className="mt-2 text-sm text-emerald-600">{t("newsletterSuccess")}</p>}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600">
          {email.includes("@") ? t("newsletterError") : t("newsletterInvalidEmail")}
        </p>
      )}
    </form>
  );
}
