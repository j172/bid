"use client";

import { useEffect, useState } from "react";
import { DEFAULT_GLOBAL_ERROR_LOCALE, GLOBAL_ERROR_COPY, detectGlobalErrorLocale } from "@/lib/globalErrorCopy";
import { useCloudflareErrorMeta } from "@/lib/useCloudflareErrorMeta";
import CloudflareErrorPage from "./components/CloudflareErrorPage";
import "./globals.css";

// Next.js's last line of defense: rendered *instead of* the root layout
// when the root layout itself throws, so — unlike app/[locale]/error.tsx —
// there is no ancestor layout left mounted to lean on. Per Next's rules
// this file must:
//   - be a Client Component ('use client', same as app/[locale]/error.tsx)
//   - render its own complete <html>/<body> (nothing above it survived)
//   - import its own stylesheet (no parent layout's <head> is available to
//     have already loaded app/globals.css)
//   - avoid any layout/provider dependency, which rules out next-intl's
//     <NextIntlClientProvider> — see lib/globalErrorCopy.ts for the small
//     hand-maintained copy + browser-language guess used here instead of
//     messages/*.json.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState(DEFAULT_GLOBAL_ERROR_LOCALE);
  // Shared with app/[locale]/error.tsx. The hook deliberately has no
  // next-intl dependency, which is what makes it usable from here.
  const { rayId, clientIp, timestamp } = useCloudflareErrorMeta(error);

  // Locale detection stays local: it reads navigator, so like the metadata
  // above it can only run after mount, but it has no counterpart on the
  // other error page (which gets its locale from the surrounding provider).
  useEffect(() => {
    setLocale(detectGlobalErrorLocale(typeof navigator === "undefined" ? undefined : navigator.languages));
  }, []);

  const copy = GLOBAL_ERROR_COPY[locale];

  return (
    <html lang={locale}>
      <body className="min-h-screen font-sans">
        <CloudflareErrorPage
          errorCode={copy.errorCode}
          heading={copy.heading}
          status={{
            browser: { label: copy.browser, ok: true },
            cloudflare: { label: copy.cloudflare, ok: true },
            host: { label: copy.host, ok: false },
          }}
          statusOkText={copy.statusOk}
          statusErrorText={copy.statusError}
          whatHappenedTitle={copy.whatHappenedTitle}
          whatHappened={copy.whatHappened}
          whatCanIDoTitle={copy.whatCanIDoTitle}
          whatCanIDo={copy.whatCanIDo}
          rayIdLabel={copy.rayId}
          rayId={rayId ?? "…"}
          timestampLabel={copy.timestamp}
          timestamp={timestamp ?? "…"}
          yourIpLabel={copy.yourIp}
          clientIp={clientIp}
          ipUnknownText={copy.ipUnknown}
          perfSecByText={copy.perfSecBy}
          homeHref="/"
          homeLabel={copy.backHome}
          retryLabel={copy.tryAgain}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
