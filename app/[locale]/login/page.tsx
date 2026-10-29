import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import LoginForm from "./LoginForm";

// Forced dynamic (runtime SSR) because CLOUDFLARE_TURNSTILE_SITE_KEY and
// GOOGLE_CLIENT_ID live only in the production host's runtime .env, not in
// the GitHub Actions build environment — prerendering this page at `next
// build` time (after issue #354 removed cookies() from layout.tsx) baked
// `turnstileSiteKey: null` and `googleClientId: null` into the static bundle,
// hiding the Turnstile widget and Google button and making every login fail
// with TURNSTILE_VERIFICATION_FAILED.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return {
    title: t("title"),
    alternates: {
      canonical: canonicalUrl(locale, "/login"),
      languages: hreflangAlternates("/login"),
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

// Server component wrapper around the (client) login form — the whole page
// used to be one "use client" component, and was split for issue #140 H-1 so
// the Turnstile *site* key can be read from the environment here and handed
// down as a prop. Site key only: it is not secret and is meant to be public
// in the rendered widget, while lib/turnstile.ts reads the *secret* key
// server-side and never sends it to the browser. Null when unconfigured, so
// LoginForm renders the login flows without the widget rather than crashing
// (e.g. local dev with no Turnstile keys) — same shape as
// app/[locale]/contact/page.tsx.
export default function LoginPage() {
  const turnstileSiteKey = process.env.CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || null;
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || null;

  return (
    <LoginForm
      turnstileSiteKey={turnstileSiteKey}
      googleClientId={googleClientId}
    />
  );
}
