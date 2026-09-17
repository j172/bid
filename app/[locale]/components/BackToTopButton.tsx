"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useCookieBannerVisible from "./useCookieBannerVisible";
import {
  FLOATING_ACTION_STACK_BOTTOM,
  FLOATING_ACTION_STACK_BOTTOM_WITH_BANNER,
} from "./floatingActionStack";

// Scroll past this many pixels (roughly one screen height) before the
// button fades in.
const SCROLL_THRESHOLD_PX = 800;

// Site-wide floating button, fixed to the bottom-right corner directly above
// LineContactButton (mounted in app/[locale]/layout.tsx, issue #305). Stays
// out of the layout (and out of the tab order) until the visitor has
// scrolled far enough down that returning to the top by hand would be
// tedious, then fades in and smooth-scrolls back to the top on click.
export default function BackToTopButton() {
  const t = useTranslations("backToTop");
  const bannerVisible = useCookieBannerVisible();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD_PX);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const bottomClass = bannerVisible
    ? FLOATING_ACTION_STACK_BOTTOM_WITH_BANNER
    : FLOATING_ACTION_STACK_BOTTOM;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={t("ariaLabel")}
      title={t("ariaLabel")}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-white text-ink shadow-lg transition-[opacity,box-shadow,transform,bottom] duration-200 hover:border-interactive-primary hover:text-interactive-primary hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive-primary active:scale-95 sm:right-6 ${bottomClass} ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
