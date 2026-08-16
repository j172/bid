// Shared by the four JSON-body POST routes that accept an optional
// client-supplied locale hint (auth/forgot-password, auth/register,
// auth/resend-verification, contact/route.ts) — issue #160 L7. Each used to
// spell out the same `routing.locales.includes(body?.locale) ? body.locale :
// routing.defaultLocale` inline. Pure/no I/O — directly unit-testable, same
// split as this project's other lib/*Validation.ts-style helpers.

import { routing } from "@/i18n/routing";

type SupportedLocale = (typeof routing.locales)[number];

export function resolveRequestLocale(body: unknown): string {
  const requested = (body as { locale?: unknown } | null)?.locale;
  return routing.locales.includes(requested as SupportedLocale) ? (requested as SupportedLocale) : routing.defaultLocale;
}
