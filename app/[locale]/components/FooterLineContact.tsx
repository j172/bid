import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { LINE_CONTACT_HREF } from "@/lib/lineContact";

// SiteFooter's "help & support" LINE row. #335 replaced a broken `~ID` link
// with a copy-phone-number flow because it believed LINE had no public
// add-friend URL scheme. #355 restores a direct link now that a valid LINE
// official-account ticket URL is available, and adds a QR code (scanning is
// the primary use case for a footer link, but it stays clickable too). No
// client-only interaction remains, so this can be a plain server component.
export default async function FooterLineContact() {
  const t = await getTranslations("lineContact");
  const tFooter = await getTranslations("footer");

  return (
    <div className="mt-1 flex items-center gap-3">
      <a
        href={LINE_CONTACT_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("ariaLabel")}
        className="inline-block text-left text-sm text-ink-light hover:text-interactive-primary"
      >
        {tFooter("supportLine")}
      </a>
      <a
        href={LINE_CONTACT_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("ariaLabel")}
        className="shrink-0"
      >
        <Image
          src="/images/line-qrcode.jpg"
          alt={t("qrCodeAlt")}
          width={64}
          height={64}
          className="h-16 w-16 rounded-md border border-border object-cover"
          unoptimized
        />
      </a>
    </div>
  );
}
