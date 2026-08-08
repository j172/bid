import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import LegalPageShell from "../components/LegalPageShell";

// Q&A pairs read straight out of messages/*.json (see LegalSections.tsx for
// why these documents keep their content as arrays in the message files).
interface FaqItem {
  question: string;
  answer: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faqPage" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: {
      canonical: canonicalUrl(locale, "/faq"),
      languages: hreflangAlternates("/faq"),
    },
  };
}

export default async function FaqPage() {
  const t = await getTranslations("faqPage");
  const items = t.raw("items") as FaqItem[];

  return (
    <LegalPageShell title={t("title")} intro={t("intro")} lastUpdated={t("lastUpdated")} notice={t("notice")}>
      {/* Native <details>/<summary> accordion — collapsible without any
          client-side JavaScript (and therefore without turning this static
          page into a client component), and each answer stays in the DOM so
          it's still found by in-page search and by crawlers. */}
      <div className="divide-y divide-border">
        {items.map((item) => (
          <details key={item.question} className="group py-4 first:pt-0 last:pb-0">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-bold text-ink hover:text-interactive-primary [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <span aria-hidden className="shrink-0 text-ink-light transition group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="mt-3 text-sm leading-7 text-ink-light">{item.answer}</p>
          </details>
        ))}
      </div>
    </LegalPageShell>
  );
}
