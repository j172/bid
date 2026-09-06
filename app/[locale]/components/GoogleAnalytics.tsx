"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const GA_MEASUREMENT_ID = "G-FT7C7FRF7P";
export const COOKIE_CONSENT_KEY = "cookieConsent";
export const COOKIE_CONSENT_EVENT = "cookieConsentChanged";

export default function GoogleAnalytics() {
  useEffect(() => {
    // Check initial consent from localStorage once hydrated
    try {
      const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      if (consent === "accepted" && typeof window.gtag === "function") {
        window.gtag("consent", "update", {
          analytics_storage: "granted",
        });
      }
    } catch {
      // Storage can throw if cookies/storage are disabled
    }

    const handleConsent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", {
          analytics_storage: customEvent.detail === "accepted" ? "granted" : "denied",
        });
      }
    };

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
  }, []);

  return (
    <>
      <Script
        id="google-analytics-consent"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            var initialConsent = 'denied';
            try {
              if (localStorage.getItem('${COOKIE_CONSENT_KEY}') === 'accepted') {
                initialConsent = 'granted';
              }
            } catch(e) {}
            gtag('consent', 'default', {
              'analytics_storage': initialConsent
            });
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `,
        }}
      />
      <Script
        id="google-analytics-tag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
    </>
  );
}
