// The "which message do I show the visitor?" half of this site's JSON API
// error convention (issue #139 item 1), kept as a pure function so it can be
// unit-tested without React or next-intl.
//
// Every route under app/api/** answers with `{ ok: true, ... }` or
// `{ ok: false, errorCode: "SOME_CODE" }` (see e.g. app/api/auth/login/
// route.ts). The client never shows a raw code: it looks the code up in the
// `errors` message namespace and falls back to the calling form's own
// `defaultError` copy when there is nothing better to show.

/**
 * Minimal structural shape of next-intl's `useTranslations("errors")` result
 * — just the parts this module needs, so tests can pass a plain fake.
 */
export interface ErrorCodeTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

/**
 * Resolves an API `errorCode` into display copy.
 *
 * Falls back to `defaultError` both when the response carried no code at all
 * and when the code has no entry in the `errors` namespace — without the
 * `has` guard next-intl would render the raw key path ("errors.FOO") at the
 * visitor, which is never what any of these forms want.
 */
export function resolveApiErrorMessage(
  errorCode: string | undefined | null,
  tErrors: ErrorCodeTranslator,
  defaultError: string,
  values?: Record<string, string | number>,
): string {
  if (!errorCode) return defaultError;
  if (!tErrors.has(errorCode)) return defaultError;
  return tErrors(errorCode, values);
}
