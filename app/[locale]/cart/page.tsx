import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cartPage" });
  return {
    title: t("title"),
    description: t("empty"),
    alternates: {
      canonical: canonicalUrl(locale, "/cart"),
      languages: hreflangAlternates("/cart"),
    },
  };
}

export default async function CartPage() {
  const t = await getTranslations("cartPage");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
        <p className="mt-4 text-ink-light">{t("empty")}</p>
        <Link href="/listings" className="mt-6 inline-flex rounded-md bg-interactive-primary px-5 py-2.5 font-semibold text-white hover:bg-interactive-primary-active">
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}