"use client";

import { useEffect, useState } from "react";
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from "./GoogleAnalytics";

// Mirrors CookieConsentBanner's own visibility check (issue #121): shown to
// a visitor exactly when there's no stored consent choice yet, hidden again
// once one is recorded. The bottom-right floating action stack (LINE
// contact button + back-to-top button, issue #305) shares this so it can
// lift clear of the banner instead of being covered by it on a first visit.
export default function useCookieBannerVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(COOKIE_CONSENT_KEY)) setVisible(true);
    } catch {
      // Storage can throw when it's disabled or full (e.g. Safari private
      // browsing) — behave as if a choice was already made.
    }

    const handleConsent = () => setVisible(false);
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
  }, []);

  return visible;
}
