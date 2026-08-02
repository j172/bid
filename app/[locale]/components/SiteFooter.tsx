import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NewsletterForm from "./NewsletterForm";

export default async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-14 border-t border-border bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
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
          <div className="mt-4 flex gap-2 text-xs">
            <span className="rounded-full border border-border px-2 py-1">FB</span>
            <span className="rounded-full border border-border px-2 py-1">X</span>
            <span className="rounded-full border border-border px-2 py-1">IG</span>
            <span className="rounded-full border border-border px-2 py-1">IN</span>
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
            <li>{t("privacy")}</li>
            <li>{t("refund")}</li>
            <li>{t("terms")}</li>
            <li>{t("faq")}</li>
            <li>
              <Link href="/contact" className="hover:text-interactive-primary">
                {t("contact")}
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
          <p>{t("payments")}</p>
        </div>
      </div>
    </footer>
  );
}
