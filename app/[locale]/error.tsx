"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getClientIpAction } from "@/lib/actions/getClientIp";
import { routing } from "@/i18n/routing";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { generateRayId } from "@/lib/rayId";
import CloudflareErrorPage from "../components/CloudflareErrorPage";

// Next.js requires error.tsx (the boundary for a route segment and its
// children — see app/global-error.tsx for the root-layout-level fallback)
// to be a Client Component, so unlike not-found.tsx this can't call
// headers()/getTranslations() directly. It's still rendered inside
// app/[locale]/layout.tsx's <NextIntlClientProvider> (that layout stays
// mounted around a thrown error — only the failing segment is replaced), so
// useLocale()/useTranslations() work here without extra plumbing.
//
// Ray ID and client IP are filled in after mount rather than during the
// initial render: this component is still server-rendered for the first
// HTML response when the triggering error happens during SSR, and
// computing a random Ray ID or awaiting the client-IP server action
// synchronously there would make that server-rendered value disagree with
// the value produced when the same component re-runs during client
// hydration — a React hydration mismatch. Starting from null on both sides
// and filling in via useEffect (which only runs after hydration) avoids
// that entirely.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  const t = useTranslations("errorPage");
  const [rayId, setRayId] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    // Logged client-side so the underlying error is still visible during
    // development / in the browser console — this component only ever
    // shows the visitor a generic message, never `error.message` itself.
    console.error(error);

    setRayId(generateRayId());
    setTimestamp(formatUtcTimestamp(new Date()));
    getClientIpAction()
      .then((ip) => setClientIp(ip))
      .catch(() => setClientIp(null));
  }, [error]);

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
