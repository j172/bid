import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import LineRegisterForm from "./LineRegisterForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lineRegister" });
  return {
    title: t("pageTitle"),
    alternates: {
      canonical: canonicalUrl(locale, "/register/line"),
      languages: hreflangAlternates("/register/line"),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function LineRegisterPage() {
  return <LineRegisterForm />;
}
