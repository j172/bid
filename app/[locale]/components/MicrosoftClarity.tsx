"use client";

import Script from "next/script";
import { useEffect } from "react";
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from "./GoogleAnalytics";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

export const CLARITY_PROJECT_ID = "ye0mdxfat2";

export default function MicrosoftClarity() {
  useEffect(() => {
    // Check initial cookie consent state on mount
    try {
      const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      if (typeof window.clarity === "function") {
        window.clarity("consent", consent === "accepted");
      }
    } catch {
      // Storage access can throw in private/restricted environments
    }

    const handleConsent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (typeof window.clarity === "function") {
        window.clarity("consent", customEvent.detail === "accepted");
      }
    };

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
  }, []);

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
        `,
      }}
    />
  );
}
