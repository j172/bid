import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import ResetPasswordForm from "./ResetPasswordForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "resetPassword" });
  return {
    title: t("title"),
    alternates: {
      canonical: canonicalUrl(locale, "/reset-password"),
      languages: hreflangAlternates("/reset-password"),
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

// ResetPasswordForm reads ?token= via next/navigation's useSearchParams,
// which requires a Suspense boundary around it (Next.js App Router opts the
// whole route into client-only rendering for that segment otherwise) — see
// app/[locale]/components/WebVitalsReporter.tsx for the only other
// useSearchParams user in this codebase, which gets away without one only
// because it's rendered outside any statically-generated page.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
