"use client";

import { useLocale, useTranslations } from "next-intl";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import Button from "@/app/components/Button";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

// Minimal shape of the global Cloudflare Turnstile API exposed by
// https://challenges.cloudflare.com/turnstile/v0/api.js once it loads.
// Explicit rendering (turnstile.render(...)), not the script's own implicit
// auto-render, since the widget container only exists once this client
// component has mounted — implicit rendering only scans the DOM once, at
// window.onload, and would miss a container added after that.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

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

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  function renderTurnstile() {
    if (!turnstileSiteKey || widgetIdRef.current || !turnstileContainerRef.current || !window.turnstile) {
      return;
    }
    widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });
  }

  // Fallback for next/script's onLoad not firing again when the api.js
  // script is already present (e.g. client-side navigation back to this
  // page within the same session) — poll briefly for window.turnstile
  // rather than relying on onLoad alone.
  useEffect(() => {
    if (!turnstileSiteKey) return;
    if (window.turnstile) {
      renderTurnstile();
      return;
    }
    const interval = setInterval(() => {
      if (window.turnstile) {
        renderTurnstile();
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnstileSiteKey]);

  function resetTurnstile() {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setTurnstileToken("");
  }

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
    resetTurnstile();

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
      {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={renderTurnstile} />}
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
        {turnstileSiteKey && <div ref={turnstileContainerRef} />}
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
