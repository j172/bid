import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ExchangeRateStrip from "./ExchangeRateStrip";
import HideOnHomepage from "./HideOnHomepage";
import NewsletterForm from "./NewsletterForm";
import { SOCIAL_LINKS } from "@/lib/socialMediaConstants";


export default async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-14 border-t border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-10 sm:px-6">
        {/* Issue #150: the homepage now shows this same card mid-page, so
            the footer's copy is hidden there to avoid showing it twice. */}
        <HideOnHomepage>
          <ExchangeRateStrip />
        </HideOnHomepage>

        <section className="rounded-2xl bg-[radial-gradient(circle_at_top_right,_#dbeafe_0,_#eff6ff_40%,_#f8fafc_100%)] px-6 py-7">
          <h3 className="text-2xl font-black text-ink">{t("newsletterTitle")}</h3>
          <p className="mt-2 text-sm text-ink-light">{t("newsletterSubtitle")}</p>
          <NewsletterForm />
        </section>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <section>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-ink">{t("helpSupportTitle")}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-light">{t("brandSubtitle")}</p>
          <p className="mt-4 text-sm font-medium text-ink">{t("supportPhone")}</p>
          <p className="text-sm text-ink-light">{t("supportEmail")}</p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href={SOCIAL_LINKS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              title="翔水鴿舍 Facebook"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink-light transition hover:border-[#1877F2] hover:bg-[#1877F2] hover:text-white hover:shadow-sm"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a
              href={SOCIAL_LINKS.youtube}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              title="翔水賽鴿 YouTube"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink-light transition hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-sm"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a
              href={SOCIAL_LINKS.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              title="翔水賽鴿 TikTok"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink-light transition hover:border-black hover:bg-black hover:text-white hover:shadow-sm"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.03 3.33-1.47 3.48-3.27.08-1.02.05-2.04.05-3.07V.02h-.7z" />
              </svg>
            </a>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-ink">{t("accountTitle")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-light">
            <li>
              <Link href="/login" className="hover:text-interactive-primary">
                {t("loginRegister")}
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-interactive-primary">
                {t("accountSettings")}
              </Link>
            </li>
            <li>
              <Link href="/my-bids" className="hover:text-interactive-primary">
                {t("myBids")}
              </Link>
            </li>
            <li>
              <Link href="/listings" className="hover:text-interactive-primary">
                {t("shop")}
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-ink">{t("quickLinksTitle")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-light">
            <li>
              <Link href="/privacy" className="hover:text-interactive-primary">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/refund" className="hover:text-interactive-primary">
                {t("refund")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-interactive-primary">
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-interactive-primary">
                {t("faq")}
              </Link>
            </li>
            <li>
              <Link href="/gdpr" className="hover:text-interactive-primary">
                {t("gdpr")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-interactive-primary">
                {t("contact")}
              </Link>
            </li>
            <li>
              <Link href="/pigeon-stations" className="hover:text-interactive-primary">
                {t("pigeonStations")}
              </Link>
            </li>
            <li>
              <Link href="/pigeon-shops" className="hover:text-interactive-primary">
                {t("pigeonShops")}
              </Link>
            </li>
            <li>
              <Link href="/pigeon-groups" className="hover:text-interactive-primary">
                {t("pigeonGroups")}
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-ink">{t("assuranceTitle")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-light">
            <li>{t("assuranceItem1")}</li>
            <li>{t("assuranceItem2")}</li>
            <li>{t("assuranceItem3")}</li>
          </ul>
        </section>
      </div>

      <div className="border-t border-border bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-ink-light sm:flex-row sm:px-6">
          <p>{t("copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
