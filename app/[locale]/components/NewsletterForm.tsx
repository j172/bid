"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isValidEmail } from "@/lib/emailValidation";
import { usePostJson } from "@/lib/usePostJson";

// Footer newsletter opt-in. Issue #139 item 19: this used to be the one
// public form that ignored the site-wide `{ ok, errorCode }` convention —
// it branched on the raw HTTP status and re-derived its message from the
// email field's shape. It now goes through the same usePostJson hook as
// every other form, so a server-side rejection with a known code (e.g.
// EMAIL_INVALID) shows that code's copy, and anything else (the mail
// provider being unconfigured or failing) falls back to `newsletterError`.
export default function NewsletterForm() {
  const t = useTranslations("footer");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const { post, submitting, error, setError } = usePostJson(t("newsletterError"));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubscribed(false);

    // Local pre-check, kept ahead of the request so an obviously malformed
    // address gets the more specific copy without a round trip. Deliberately
    // the very rule the subscribe endpoint enforces (lib/emailValidation.ts,
    // issue #140 M-2) rather than a looser approximation, so this never waves
    // through an address the server will reject.
    if (!isValidEmail(email)) {
      setError(t("newsletterInvalidEmail"));
      return;
    }

    const data = await post("/api/newsletter/subscribe", { email });
    if (!data) return;

    setSubscribed(true);
    setEmail("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mt-4 flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSubscribed(false);
            setError(null);
          }}
          placeholder={t("newsletterPlaceholder")}
          required
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="whitespace-nowrap rounded-md bg-interactive-primary px-3 py-2 text-sm font-semibold text-white hover:bg-interactive-primary-active disabled:opacity-60"
        >
          {submitting ? t("newsletterSubscribing") : t("subscribe")}
        </button>
      </div>
      {subscribed && <p className="mt-2 text-sm text-emerald-600">{t("newsletterSuccess")}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
