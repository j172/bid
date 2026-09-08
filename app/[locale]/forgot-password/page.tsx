import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import ForgotPasswordForm from "./ForgotPasswordForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "forgotPassword" });
  return {
    title: t("title"),
    alternates: {
      canonical: canonicalUrl(locale, "/forgot-password"),
      languages: hreflangAlternates("/forgot-password"),
    },
  };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
