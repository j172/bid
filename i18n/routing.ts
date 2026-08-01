import { defineRouting } from "next-intl/routing";

// The admin backend (/z04urru6/**) is deliberately NOT part of this routing
// — it stays hardcoded Traditional Chinese and unprefixed (see middleware.ts's
// matcher, which excludes it entirely). Only the public-facing site is
// translated.
export const routing = defineRouting({
  locales: ["zh-TW", "zh-CN", "en"],
  defaultLocale: "zh-TW",
  // The default locale (zh-TW, this site's original language) keeps its
  // existing unprefixed URLs (/listings, not /zh-TW/listings); only zh-CN
  // and en get a URL prefix.
  localePrefix: "as-needed",
});
