"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LINE_CONTACT_PHONE } from "@/lib/lineContact";

// SiteFooter's "help & support" LINE row (issue #335). LINE has no public
// URL scheme for "add friend by phone number", so instead of linking out,
// clicking copies the support phone number and shows an instruction to
// search for it inside the LINE app. A client component because SiteFooter
// itself is an async server component and this needs onClick + clipboard.
export default function FooterLineContact() {
  const t = useTranslations("lineContact");
  const tFooter = useTranslations("footer");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 4000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleClick() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(LINE_CONTACT_PHONE);
      } else {
        const input = document.createElement("input");
        input.value = LINE_CONTACT_PHONE;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
    } catch {
      // Clipboard access can be blocked/unavailable — the number is still
      // shown in the label so the visitor can copy it manually.
    }
    setCopied(true);
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("ariaLabel")}
        className="inline-block text-left text-sm text-ink-light hover:text-interactive-primary"
      >
        {tFooter("supportLine", { phone: LINE_CONTACT_PHONE })}
      </button>
      <p role="status" className="mt-1 text-xs text-ink-light">
        {copied ? t("copied") : t("instruction")}
      </p>
    </div>
  );
}
