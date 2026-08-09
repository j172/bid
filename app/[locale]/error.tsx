"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { useCloudflareErrorMeta } from "@/lib/useCloudflareErrorMeta";
import CloudflareErrorPage from "../components/CloudflareErrorPage";

// Next.js requires error.tsx (the boundary for a route segment and its
// children — see app/global-error.tsx for the root-layout-level fallback)
// to be a Client Component, so unlike not-found.tsx this can't call
// headers()/getTranslations() directly. It's still rendered inside
// app/[locale]/layout.tsx's <NextIntlClientProvider> (that layout stays
// mounted around a thrown error — only the failing segment is replaced), so
// useLocale()/useTranslations() work here without extra plumbing.
//
// Ray ID, client IP and timestamp come from useCloudflareErrorMeta, shared
// with app/global-error.tsx — see that hook for why they're filled in after
// mount rather than during the initial render.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  const t = useTranslations("errorPage");
  const { rayId, clientIp, timestamp } = useCloudflareErrorMeta(error);

  const homeHref = locale === routing.defaultLocale ? "/" : `/${locale}`;

  return (
    <CloudflareErrorPage
      errorCode={t("serverError.errorCode")}
      heading={t("serverError.heading")}
      status={{
        browser: { label: t("labels.browser"), ok: true },
        cloudflare: { label: t("labels.cloudflare"), ok: true },
        host: { label: t("labels.host"), ok: false },
      }}
      statusOkText={t("labels.statusOk")}
      statusErrorText={t("labels.statusError")}
      whatHappenedTitle={t("labels.whatHappenedTitle")}
      whatHappened={t("serverError.whatHappened")}
      whatCanIDoTitle={t("labels.whatCanIDoTitle")}
      whatCanIDo={t("serverError.whatCanIDo")}
      rayIdLabel={t("labels.rayId")}
      rayId={rayId ?? "…"}
      timestampLabel={t("labels.timestamp")}
      timestamp={timestamp ?? "…"}
      yourIpLabel={t("labels.yourIp")}
      clientIp={clientIp}
      ipUnknownText={t("labels.ipUnknown")}
      perfSecByText={t("labels.perfSecBy")}
      homeHref={homeHref}
      homeLabel={t("labels.backHome")}
      retryLabel={t("labels.tryAgain")}
      onRetry={reset}
    />
  );
}
