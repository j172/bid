"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { useCloudflareErrorMeta } from "@/lib/useCloudflareErrorMeta";
import CloudflareErrorPage from "../components/CloudflareErrorPage";

// Rendered whenever a route under [locale] doesn't match anything, or a
// page explicitly calls next/navigation's notFound(). It's nested inside
// app/[locale]/layout.tsx's already-rendered <NextIntlClientProvider>, so
// useLocale()/useTranslations() resolve the current locale here without
// needing params — same reasoning as app/[locale]/error.tsx.
//
// Issue #354: this used to be a plain async Server Component that called
// next/headers' headers() directly to derive rayId/clientIp. That's a
// Next.js "dynamic API" — even though only this not-found boundary used it,
// its presence forced the *entire* [locale] route tree to render dynamically
// on every request, silently overriding every other page's own
// `revalidate`/static output (verified empirically: with this call removed,
// pages with no dynamic API of their own started prerendering as static/ISR
// again). It's now a Client Component using the same
// useCloudflareErrorMeta() hook error.tsx/global-error.tsx already use for
// exactly this constraint — rayId/clientIp are fetched once after mount via
// Server Actions (lib/actions/getRayId.ts, lib/actions/getClientIp.ts)
// instead of being read during the server render pass. See that hook's
// comment for why the values are filled in post-mount rather than awaited
// here (hydration-mismatch avoidance).
export default function NotFound() {
  const locale = useLocale();
  const t = useTranslations("errorPage");
  const { rayId, clientIp, timestamp } = useCloudflareErrorMeta();

  const homeHref = locale === routing.defaultLocale ? "/" : `/${locale}`;

  return (
    <CloudflareErrorPage
      errorCode={t("notFound.errorCode")}
      heading={t("notFound.heading")}
      status={{
        browser: { label: t("labels.browser"), ok: true },
        cloudflare: { label: t("labels.cloudflare"), ok: true },
        host: { label: t("labels.host"), ok: true },
      }}
      statusOkText={t("labels.statusOk")}
      statusErrorText={t("labels.statusError")}
      whatHappenedTitle={t("labels.whatHappenedTitle")}
      whatHappened={t("notFound.whatHappened")}
      whatCanIDoTitle={t("labels.whatCanIDoTitle")}
      whatCanIDo={t("notFound.whatCanIDo")}
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
    />
  );
}
