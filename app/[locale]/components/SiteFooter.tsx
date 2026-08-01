import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NewsletterForm from "./NewsletterForm";

export default async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-14 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <section>
          <h3 className="text-lg font-bold text-ink">{t("brandTitle")}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-light">{t("brandSubtitle")}</p>
          <p className="mt-4 text-sm font-medium text-ink">{t("supportPhone")}</p>
          <p className="text-sm text-ink-light">{t("supportEmail")}</p>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink">{t("accountTitle")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-light">
            <li>
              <Link href="/login" className="hover:text-gold">
                {t("loginRegister")}
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-gold">
                {t("accountSettings")}
              </Link>
            </li>
            <li>
              <Link href="/my-bids" className="hover:text-gold">
                {t("myBids")}
              </Link>
            </li>
            <li>
              <Link href="/listings" className="hover:text-gold">
                {t("shop")}
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink">{t("quickLinksTitle")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-light">
            <li>{t("privacy")}</li>
            <li>{t("refund")}</li>
            <li>{t("terms")}</li>
            <li>{t("faq")}</li>
            <li>
              <Link href="/account" className="hover:text-gold">
                {t("contact")}
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink">{t("newsletterTitle")}</h3>
          <p className="mt-3 text-sm text-ink-light">{t("newsletterSubtitle")}</p>
          <NewsletterForm />
        </section>
      </div>

      <div className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-ink-light sm:flex-row sm:px-6">
          <p>{t("copyright")}</p>
          <p>{t("payments")}</p>
        </div>
      </div>
    </footer>
  );
}
