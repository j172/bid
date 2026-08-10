"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import Button from "@/app/components/Button";
import TurnstileWidget, { type TurnstileWidgetHandle } from "@/app/components/TurnstileWidget";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";

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
  const locale = useLocale();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { post, submitting, error } = usePostJson(t("defaultError"));

  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    const data = await post("/api/contact", { name, email, subject, message, turnstileToken, locale });

    // A Turnstile token is single-use, so the widget is reset either way —
    // otherwise a retry after a failed submit would send a spent token.
    turnstileRef.current?.reset();

    if (!data) return;

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
