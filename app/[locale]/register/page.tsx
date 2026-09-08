import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import RegisterForm from "./RegisterForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "register" });
  return {
    title: t("title"),
    alternates: {
      canonical: canonicalUrl(locale, "/register"),
      languages: hreflangAlternates("/register"),
    },
  };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
