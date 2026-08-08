"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import Button from "@/app/components/Button";
import TurnstileWidget, { type TurnstileWidgetHandle } from "@/app/components/TurnstileWidget";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

interface ContactFormProps {
  // Turnstile *site* key (not secret) — null when CLOUDFLARE_TURNSTILE_SITE_KEY
  // isn't configured, in which case the widget is skipped entirely rather
  // than shown broken (the server route still requires a valid token
  // whenever CLOUDFLARE_TURNSTILE_SECRET_KEY is set, so this is only a
  // meaningful bypass in an environment that also has no secret key).
  turnstileSiteKey: string | null;
}

export default function ContactForm({ turnstileSiteKey }: ContactFormProps) {
  const t = useTranslations("contactPage");
  const tErrors = useTranslations("errors");
  const locale = useLocale();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, message, turnstileToken, locale }),
    });
    const data = await response.json();

    setSubmitting(false);
    turnstileRef.current?.reset();

    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }

    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setNotice(t("success"));
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3">
        <input
          className={inputClass}
          placeholder={t("namePlaceholder")}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={inputClass}
          type="email"
          placeholder={t("emailPlaceholder")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder={t("subjectPlaceholder")}
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className={`min-h-28 ${inputClass}`}
          placeholder={t("messagePlaceholder")}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {turnstileSiteKey && <TurnstileWidget ref={turnstileRef} siteKey={turnstileSiteKey} onToken={setTurnstileToken} />}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || (Boolean(turnstileSiteKey) && !turnstileToken)}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
          {error && <span className="text-sm text-ended">{error}</span>}
          {notice && <span className="text-sm text-leading">{notice}</span>}
        </div>
      </form>
    </>
  );
}
