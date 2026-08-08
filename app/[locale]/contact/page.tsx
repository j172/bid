import { getTranslations } from "next-intl/server";
import ContactForm from "./ContactForm";

export default async function ContactPage() {
  const t = await getTranslations("contactPage");
  // Site key only — not secret, safe to hand to the client form as a prop
  // (see lib/turnstile.ts, which reads the *secret* key server-side only,
  // never sent to the browser). Null when unconfigured so ContactForm can
  // render the form without the widget rather than crash (e.g. local dev
  // without Turnstile keys set).
  const turnstileSiteKey = process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
        <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink">{t("infoTitle")}</h2>
          <p className="mt-4 text-sm text-ink-light">{t("email")}</p>
          <p className="mt-2 text-sm text-ink-light">{t("phone")}</p>
          <p className="mt-2 text-sm text-ink-light">{t("address")}</p>
        </article>

        <article className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink">{t("formTitle")}</h2>
          <ContactForm turnstileSiteKey={turnstileSiteKey} />
        </article>
      </section>
    </main>
  );
}
