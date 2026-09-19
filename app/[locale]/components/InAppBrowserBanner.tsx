"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getDevicePlatform, isInAppBrowser, type DevicePlatform } from "@/lib/inAppBrowser";

export const INAPP_DISMISSED_STORAGE_KEY = "dismissed_inapp_banner";

export default function InAppBrowserBanner() {
  const t = useTranslations("inAppBrowser");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>("other");

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const ua = window.navigator.userAgent;
      if (!isInAppBrowser(ua)) return;

      const dismissed = window.sessionStorage.getItem(INAPP_DISMISSED_STORAGE_KEY);
      if (!dismissed) {
        setPlatform(getDevicePlatform(ua));
        setVisible(true);
      }
    } catch {
      // Storage access can fail in restricted/private modes — ignore safely
    }
  }, []);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const input = document.createElement("input");
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fail quietly if clipboard is blocked
    }
  }

  function handleDismiss() {
    try {
      window.sessionStorage.setItem(INAPP_DISMISSED_STORAGE_KEY, "1");
    } catch {
      // Ignore sessionStorage write errors
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label={t("ariaLabel")}
      className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 text-amber-950 shadow-sm transition-all"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800" aria-hidden="true">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </span>

          <div className="text-xs leading-5 sm:text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-amber-200/80 px-2 py-0.5 text-xs font-bold text-amber-900">
                {t("badge")}
              </span>
              <span className="font-medium text-amber-900">{t("message")}</span>
            </div>
            <p className="mt-1 font-semibold text-amber-800">
              {platform === "ios" ? t("iosGuide") : platform === "android" ? t("androidGuide") : t("androidGuide")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 active:scale-95"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{t("copied")}</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>{t("copyLink")}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("dismiss")}
            title={t("dismiss")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-700 transition hover:bg-amber-200/70 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
