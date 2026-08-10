"use client";

import Script from "next/script";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

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

export interface TurnstileWidgetHandle {
  // Discards the token this widget last handed out and asks Cloudflare for a
  // fresh challenge. Callers must do this after every submit attempt: a
  // Turnstile token is single-use, so a retry with the same token would be
  // rejected server-side (see lib/turnstile.ts).
  reset: () => void;
}

interface TurnstileWidgetProps {
  // Turnstile *site* key (not secret). Callers that may not have one
  // configured render nothing at all rather than passing null (see
  // app/[locale]/login/LoginForm.tsx), so this is always a real key here.
  siteKey: string;
  // Called with the token on success, and with "" whenever the current token
  // stops being usable (expired, or the widget errored).
  onToken: (token: string) => void;
  ref?: Ref<TurnstileWidgetHandle>;
}

// The shared "render a Turnstile challenge in this form" building block,
// extracted from app/[locale]/contact/ContactForm.tsx (issue #104) when the
// login page (issue #140 H-1) needed two more instances of exactly the same
// dance. Each instance owns its own container and its own widget id, so a
// page may mount several — the login page does, one per submitting step,
// because a token spent on POST /api/auth/login cannot be replayed on POST
// /api/auth/verify-totp.
export default function TurnstileWidget({ siteKey, onToken, ref }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Kept in a ref so a caller passing an inline arrow function doesn't have
  // to be memoised to avoid re-rendering the widget.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  function renderWidget() {
    if (widgetIdRef.current || !containerRef.current || !window.turnstile) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(""),
      "error-callback": () => onTokenRef.current(""),
    });
  }

  // Fallback for next/script's onLoad not firing again when the api.js
  // script is already present (e.g. client-side navigation back to this
  // page within the same session, or a second widget mounting after the
  // first one already loaded it) — poll briefly for window.turnstile rather
  // than relying on onLoad alone.
  useEffect(() => {
    if (window.turnstile) {
      renderWidget();
      return;
    }
    const interval = setInterval(() => {
      if (window.turnstile) {
        renderWidget();
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
      onTokenRef.current("");
    },
  }), []);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={renderWidget} />
      <div ref={containerRef} />
    </>
  );
}
