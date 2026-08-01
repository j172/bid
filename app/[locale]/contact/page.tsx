import { getTranslations } from "next-intl/server";

export default async function ContactPage() {
  const t = await getTranslations("contactPage");

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
          <form className="mt-4 grid grid-cols-1 gap-3">
            <input className="rounded-md border border-border px-3 py-2" placeholder={t("namePlaceholder")} />
            <input className="rounded-md border border-border px-3 py-2" placeholder={t("emailPlaceholder")} />
            <input className="rounded-md border border-border px-3 py-2" placeholder={t("subjectPlaceholder")} />
            <textarea className="min-h-28 rounded-md border border-border px-3 py-2" placeholder={t("messagePlaceholder")} />
            <button type="button" className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark">
              {t("submit")}
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}