// app/global-error.tsx is Next.js's absolute last line of defense — it
// replaces the *entire* document when even the root layout throws, so per
// Next's own rules it can't render inside any layout or provider,
// including next-intl's <NextIntlClientProvider>. That rules out the
// messages/*.json + getTranslations()/useTranslations() machinery every
// other page here uses (see app/[locale]/not-found.tsx and
// app/[locale]/error.tsx), so this is a small, self-contained copy of just
// the strings that page needs, with a best-effort language guess from the
// browser instead of next-intl's locale resolution.

export type GlobalErrorLocale = "zh-TW" | "zh-CN" | "en";

export interface GlobalErrorCopy {
  errorCode: string;
  heading: string;
  whatHappenedTitle: string;
  whatHappened: string;
  whatCanIDoTitle: string;
  whatCanIDo: string;
  browser: string;
  cloudflare: string;
  host: string;
  statusOk: string;
  statusError: string;
  rayId: string;
  timestamp: string;
  yourIp: string;
  ipUnknown: string;
  perfSecBy: string;
  backHome: string;
  tryAgain: string;
}

// Kept in sync by hand with messages/*.json's errorPage.labels /
// errorPage.serverError — this file intentionally has no build-time link to
// those (see the header comment above for why), so if that copy changes,
// this should be updated to match.
export const GLOBAL_ERROR_COPY: Record<GlobalErrorLocale, GlobalErrorCopy> = {
  "zh-TW": {
    errorCode: "500",
    heading: "發生錯誤",
    whatHappenedTitle: "發生了什麼事？",
    whatHappened: "載入這個頁面時發生未預期的錯誤，我們已經記錄下來並會盡快處理。",
    whatCanIDoTitle: "我可以怎麼做？",
    whatCanIDo: "請稍後再試一次；如果問題持續發生，歡迎與我們聯繫並告訴我們發生問題時您正在做什麼。",
    browser: "瀏覽器",
    cloudflare: "Cloudflare",
    host: "主機",
    statusOk: "正常",
    statusError: "錯誤",
    rayId: "Ray ID",
    timestamp: "時間戳記",
    yourIp: "您的 IP",
    ipUnknown: "無法取得",
    perfSecBy: "效能與安全性由 Cloudflare 提供",
    backHome: "回首頁",
    tryAgain: "重試",
  },
  "zh-CN": {
    errorCode: "500",
    heading: "发生错误",
    whatHappenedTitle: "发生了什么？",
    whatHappened: "加载此页面时发生了未预期的错误，我们已记录下来并会尽快处理。",
    whatCanIDoTitle: "我可以怎么做？",
    whatCanIDo: "请稍后再试一次；如果问题持续发生，欢迎与我们联系并告诉我们发生问题时您正在做什么。",
    browser: "浏览器",
    cloudflare: "Cloudflare",
    host: "主机",
    statusOk: "正常",
    statusError: "错误",
    rayId: "Ray ID",
    timestamp: "时间戳",
    yourIp: "您的 IP",
    ipUnknown: "无法获取",
    perfSecBy: "性能与安全由 Cloudflare 提供",
    backHome: "返回首页",
    tryAgain: "重试",
  },
  en: {
    errorCode: "500",
    heading: "Something went wrong",
    whatHappenedTitle: "What happened?",
    whatHappened: "An unexpected error occurred while trying to load this page. This has been logged and we'll look into it.",
    whatCanIDoTitle: "What can I do?",
    whatCanIDo: "Please try again in a few minutes. If the problem keeps happening, get in touch and let us know what you were doing when it occurred.",
    browser: "Browser",
    cloudflare: "Cloudflare",
    host: "Host",
    statusOk: "Working",
    statusError: "Error",
    rayId: "Ray ID",
    timestamp: "Timestamp",
    yourIp: "Your IP",
    ipUnknown: "Unavailable",
    perfSecBy: "Performance & security by Cloudflare",
    backHome: "Back to homepage",
    tryAgain: "Try again",
  },
};

// This project's own default locale (see i18n/routing.ts) doubles as the
// safe fallback here for the server-rendered pass, before the client-side
// navigator.language check (see detectGlobalErrorLocale) can run.
export const DEFAULT_GLOBAL_ERROR_LOCALE: GlobalErrorLocale = "zh-TW";

// Best-effort match against this site's three supported locales from the
// browser's language preferences. Deliberately simple (no BCP-47 parsing
// library) since this only ever needs to pick one of three buckets, and a
// wrong guess just means a visitor sees the fallback locale's copy on the
// one page on the site that can't reach next-intl's proper locale
// resolution.
export function detectGlobalErrorLocale(languages: readonly string[] | undefined | null): GlobalErrorLocale {
  for (const raw of languages ?? []) {
    const lang = raw.toLowerCase();
    if (!lang.startsWith("zh")) continue;
    if (lang.includes("cn") || lang.includes("hans") || lang.includes("sg")) return "zh-CN";
    return "zh-TW";
  }
  for (const raw of languages ?? []) {
    if (raw.toLowerCase().startsWith("en")) return "en";
  }
  return DEFAULT_GLOBAL_ERROR_LOCALE;
}
