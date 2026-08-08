import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { resolveRayId } from "@/lib/rayId";
import CloudflareErrorPage from "../components/CloudflareErrorPage";

// Rendered whenever a route under [locale] doesn't match anything, or a
// page explicitly calls next/navigation's notFound(). This is a plain
// (async) Server Component — it's nested inside app/[locale]/layout.tsx's
// already-rendered <NextIntlClientProvider>, and that layout already called
// setRequestLocale(locale) for this request, so getLocale()/getTranslations()
// resolve the current locale here without needing params. See
// app/components/CloudflareErrorPage.tsx for the shared visual shell,
// issue #65 for why this deliberately looks like a Cloudflare error page
// instead of using the site's own brand colors, and issue #127 for how
// rayId below can now be a real, verified Cloudflare Ray ID.
export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations("errorPage");

  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const rayId = resolveRayId(headersList);
  const timestamp = formatUtcTimestamp(new Date());
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
      rayId={rayId}
      timestampLabel={t("labels.timestamp")}
      timestamp={timestamp}
      yourIpLabel={t("labels.yourIp")}
      clientIp={clientIp}
      ipUnknownText={t("labels.ipUnknown")}
      perfSecByText={t("labels.perfSecBy")}
      homeHref={homeHref}
      homeLabel={t("labels.backHome")}
    />
  );
}
