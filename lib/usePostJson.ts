"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessage";

// Shared "POST JSON to one of our own API routes" hook (issue #139 item 1).
//
// Before this existed, eighteen call sites across twelve client components
// hand-rolled the identical sequence: flip a `submitting` flag, clear the
// error, fetch(), await response.json(), branch on `data.ok`, and translate
// `data.errorCode` through the `errors` namespace with the component's own
// `defaultError` as the fallback. This hook owns that sequence; the caller
// keeps whatever *else* it needs to do on success (navigate, refresh, show a
// notice, advance a wizard step).
//
// Callers that drive several independent flows from one component (the login
// page's password / TOTP / Email OTP / passkey branches) create one instance
// per flow so each keeps its own `submitting` and `error`.

/** Shape every app/api/** route answers with — see lib/apiErrorMessage.ts. */
export interface ApiJsonResponse {
  ok?: boolean;
  errorCode?: string;
}

export interface PostJsonOptions<T extends ApiJsonResponse> {
  /**
   * Extra ICU values for the `errors` namespace message, derived from the
   * failing response — e.g. BidForm's BID_TOO_LOW copy interpolates the
   * response's own `minimumNextBid`.
   */
  errorValues?: (data: T) => Record<string, string | number>;
  /**
   * Side effect for the handful of error codes a caller reacts to beyond
   * showing the message — the login page's EMAIL_NOT_VERIFIED (offer a
   * resend) and EMAIL_OTP_TOO_MANY_ATTEMPTS (the challenge is spent, drop
   * back to the password form). Runs before `error` is set.
   */
  onFailure?: (data: T) => void;
}

export interface UsePostJsonResult {
  /**
   * POSTs `body` as JSON (or sends a bodiless POST when `body` is omitted,
   * matching the routes that take no payload) and resolves to the parsed
   * response on success, or `null` after having set `error` on failure.
   */
  post: <T extends ApiJsonResponse>(url: string, body?: unknown, options?: PostJsonOptions<T>) => Promise<T | null>;
  submitting: boolean;
  error: string | null;
  /** For the local, non-API failures a form raises itself (password mismatch, WebAuthn browser errors, ...). */
  setError: (message: string | null) => void;
}

export function usePostJson(defaultError: string): UsePostJsonResult {
  const tErrors = useTranslations("errors");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(
    async <T extends ApiJsonResponse>(url: string, body?: unknown, options?: PostJsonOptions<T>): Promise<T | null> => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch(
          url,
          body === undefined
            ? { method: "POST" }
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              },
        );
        const data = (await response.json()) as T;

        if (!data.ok) {
          options?.onFailure?.(data);
          setError(resolveApiErrorMessage(data.errorCode, tErrors, defaultError, options?.errorValues?.(data)));
          return null;
        }
        return data;
      } finally {
        // `finally` rather than a plain call after the await: a network-level
        // failure (offline, aborted request) still rejects out to the caller,
        // but no longer leaves the submit button disabled forever.
        setSubmitting(false);
      }
    },
    [tErrors, defaultError],
  );

  return { post, submitting, error, setError };
}
