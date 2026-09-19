import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import VerifyEmailForm from "./VerifyEmailForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verifyEmail" });
  return {
    title: t("title"),
    alternates: {
      canonical: canonicalUrl(locale, "/verify-email"),
      languages: hreflangAlternates("/verify-email"),
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

// VerifyEmailForm reads ?token= via next/navigation's useSearchParams, which
// requires a Suspense boundary around it — same reason and same split as
// app/[locale]/reset-password/page.tsx/ResetPasswordForm.tsx.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
