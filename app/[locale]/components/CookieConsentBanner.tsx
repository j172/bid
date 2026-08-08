"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/app/components/Button";

// Non-blocking bottom banner shown to every first-time visitor in every
// locale (issue #121) — no geolocation gating. The choice is recorded in
// localStorage, not a cookie: the whole point is that this site sets nothing
// beyond the login session cookie (see the GDPR page's cookie section), so
// asking about cookies by writing one would be self-defeating.
const STORAGE_KEY = "cookieConsent";

// "rejected" has no functional effect today — there are no non-essential
// cookies to switch off — it's stored so a future analytics/marketing
// integration can read the visitor's existing preference instead of asking
// again.
type Consent = "accepted" | "rejected";

export default function CookieConsentBanner() {
  const t = useTranslations("cookieBanner");
  // Starts hidden and only turns on from the effect below: localStorage isn't
  // readable while server-rendering, so anything else would either mismatch
  // during hydration or flash the banner at visitors who already chose.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage can throw when it's disabled or full (e.g. Safari private
      // browsing) — skip the banner rather than break the page.
    }
  }, []);

  function choose(consent: Consent) {
    try {
      window.localStorage.setItem(STORAGE_KEY, consent);
    } catch {
      // Same as above: if we can't persist the choice we still dismiss the
      // banner for this session rather than trap the visitor with it.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t("ariaLabel")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-xs leading-6 text-ink-light">
          {t("message")}{" "}
          <Link href="/gdpr" className="font-medium text-interactive-primary hover:underline">
            {t("policyLink")}
          </Link>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink transition hover:border-interactive-primary hover:text-interactive-primary"
          >
            {t("reject")}
          </button>
          <Button type="button" onClick={() => choose("accepted")} className="text-sm">
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
