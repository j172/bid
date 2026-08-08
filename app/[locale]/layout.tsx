import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { routing } from "@/i18n/routing";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import WebVitalsReporter from "./components/WebVitalsReporter";
import "../globals.css";

// The public site's own independent root layout (its own <html>/<body>) —
// see app/z04urru6/layout.tsx for the admin backend's separate root. There's
// deliberately no shared top-level app/layout.tsx: next-intl's routing (see
// middleware.ts) only ever sends requests for the public site into this
// [locale]-prefixed tree.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  return {
    // `template` lets every child page's generateMetadata just return a
    // plain string title (e.g. a listing's own title) and automatically get
    // " | <site name>" appended by Next — see the listing detail/list pages'
    // own generateMetadata (issue #107) for that in action. The homepage
    // itself keeps its own full title via `default` rather than going
    // through the template.
    title: {
      default: t("title"),
      template: `%s | ${tNav("siteName")}`,
    },
    description: t("metaDescription"),
    icons: {
      icon: "/images/hero-placeholder.png",
      shortcut: "/images/hero-placeholder.png",
      apple: "/images/hero-placeholder.png",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen font-sans text-ink">
        <NextIntlClientProvider>
          <Suspense fallback={null}>
            <WebVitalsReporter />
          </Suspense>
          <SiteHeader />
          {children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
