"use client";

import { useTranslations } from "next-intl";
import { LINE_CONTACT_HREF } from "@/lib/lineContact";
import useCookieBannerVisible from "./useCookieBannerVisible";
import {
  FLOATING_ACTION_BOTTOM,
  FLOATING_ACTION_BOTTOM_WITH_BANNER,
} from "./floatingActionStack";

// Site-wide floating button, fixed to the bottom-right corner (mounted in
// app/[locale]/layout.tsx alongside CookieConsentBanner). Opens the LINE
// add-friend page in a new tab so the visitor never loses their place on
// the site.
export default function LineContactButton() {
  const t = useTranslations("lineContact");
  const bannerVisible = useCookieBannerVisible();
  const bottomClass = bannerVisible ? FLOATING_ACTION_BOTTOM_WITH_BANNER : FLOATING_ACTION_BOTTOM;

  return (
    <a
      href={LINE_CONTACT_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("ariaLabel")}
      title={t("ariaLabel")}
      className={`fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#06C755] text-white shadow-lg transition-[background-color,box-shadow,transform,bottom] duration-200 hover:bg-[#05a648] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06C755] active:scale-95 sm:right-6 ${bottomClass}`}
    >
      <svg
        className="h-6 w-6 fill-current"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V7.812c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V7.812c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V7.813c0-.345.282-.63.63-.63.345 0 .63.285.63.63v5.066zm-5.741-.629c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V7.812c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.938zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V7.812c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.438h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
    </a>
  );
}
