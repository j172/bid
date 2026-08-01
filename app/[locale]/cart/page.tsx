import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function CartPage() {
  const t = await getTranslations("cartPage");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
        <p className="mt-4 text-ink-light">{t("empty")}</p>
        <Link href="/listings" className="mt-6 inline-flex rounded-md bg-gold px-5 py-2.5 font-semibold text-white hover:bg-gold-dark">
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}