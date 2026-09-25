"use client";

import { useTranslations } from "next-intl";

interface LineSignInButtonProps {
  mode?: "login" | "register";
  returnTo?: string;
  className?: string;
}

export default function LineSignInButton({
  mode = "login",
  returnTo = "/",
  className = "",
}: LineSignInButtonProps) {
  const t = useTranslations("login");

  const buttonText = mode === "register" ? t("lineRegisterButton") : t("lineLoginButton");
  const targetUrl = `/api/auth/line?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <a
      href={targetUrl}
      aria-label={buttonText}
      className={`inline-flex w-full items-center justify-center gap-2.5 rounded-md px-4 py-2.5 text-sm font-bold text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:ring-offset-2 bg-[#06C755] hover:bg-[#05B04B] active:bg-[#049B42] ${className}`}
    >
      <svg
        className="h-5 w-5 shrink-0 fill-current"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12 2C6.48 2 2 5.82 2 10.53c0 2.92 1.74 5.51 4.41 7.06-.19.67-.68 2.45-.78 2.82-.12.46.17.45.36.33.15-.1 2.05-1.39 2.88-1.95.36.05.73.08 1.13.08 5.52 0 10-3.82 10-8.53C20 5.82 17.52 2 12 2zm-4.7 10.96H5.43c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h1.87c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4H6.37v1.17h.93c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4h-.93v1.23h.93c.22 0 .4.18.4.4v.67c0 .22-.18.35-.4.35zm3.07 0h-.94c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h.94c.22 0 .4.18.4.4v5.06c0 .22-.18.4-.4.4zm4.18 0h-.87c-.16 0-.3-.09-.36-.23L11.75 9.8v2.76c0 .22-.18.4-.4.4h-.94c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h.87c.16 0 .3.09.36.23l1.57 2.93V7.5c0-.22.18-.4.4-.4h.94c.22 0 .4.18.4.4v5.06c0 .22-.18.4-.4.4zm3.85-3.32h-.93v1.19h.93c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4h-1.87c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h1.87c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4h-.93v1.17h.93c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4z" />
      </svg>
      <span>{buttonText}</span>
    </a>
  );
}
