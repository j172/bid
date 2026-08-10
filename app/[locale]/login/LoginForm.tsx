"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import TurnstileWidget, { type TurnstileWidgetHandle } from "@/app/components/TurnstileWidget";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";
import AuthFormShell from "../components/AuthFormShell";
import EmailOtpStep from "./EmailOtpStep";
import PasskeyLoginButton from "./PasskeyLoginButton";
import TotpStep from "./TotpStep";

interface LoginFormProps {
  // Turnstile *site* key (not secret) — null when
  // CLOUDFLARE_TURNSTILE_SITE_KEY isn't configured, in which case both this
  // form's widget and TotpStep's are skipped rather than shown broken,
  // exactly as app/[locale]/contact/ContactForm.tsx does. The routes still
  // require a valid token whenever CLOUDFLARE_TURNSTILE_SECRET_KEY is set, so
  // this is only a real bypass in an environment that has neither key.
  turnstileSiteKey: string | null;
}

interface LoginResponse {
  ok?: boolean;
  errorCode?: string;
  twoFactorRequired?: boolean;
  twoFactorMethod?: string;
  challengeToken?: string;
}

// The password half of the login flow, plus the routing between the second
// steps it can hand off to. Split out of app/[locale]/login/page.tsx (issue
// #140 H-1) so that page can be a server component and read
// CLOUDFLARE_TURNSTILE_SITE_KEY from the environment; issue #139 item 4 then
// moved each second step into its own component (TotpStep / EmailOtpStep /
// PasskeyLoginButton), so this file now only owns what the password form
// itself needs: the credentials, the "verify your email first" branch, which
// step is currently showing, and its own Turnstile challenge.
export default function LoginForm({ turnstileSiteKey }: LoginFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { post, submitting, error, setError } = usePostJson(t("defaultError"));

  // Registration email-ownership verification (issue #118): a login attempt
  // against a not-yet-verified account fails with EMAIL_NOT_VERIFIED instead
  // of creating a session (see app/api/auth/login/route.ts). This flag
  // switches the error message into one offering a resend button rather than
  // the generic error text — the email the visitor already typed into the
  // form above is reused for the resend call, so they never have to retype
  // it. Same "resend, rate-limited the same way as forgot-password" endpoint
  // as app/[locale]/forgot-password/page.tsx's submit — the response is
  // deliberately neutral (see that route's header comment) so this always
  // just reports "sent" without revealing whether the account existed.
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Which second step (if any) the login response asked for. Both are
  // entered in place, without navigating — see the two step components.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpRequired, setTotpRequired] = useState(false);

  // Cloudflare Turnstile (issue #140 H-1) — one widget per *submitting step*,
  // not one per page: a token is single-use, and the password step and the
  // TOTP step are two separate requests to two separate routes that each
  // verify a token of their own. This component therefore only owns the
  // password step's widget; TotpStep mounts its own from the same site key
  // (see the prop passed below), and the two never share a token. The other
  // three flows on this page (resend-verification, Email OTP verify, passkey)
  // are out of scope and post no token.
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  // True while the widget is configured but hasn't handed us a token yet
  // (still loading, or the visitor hasn't passed the challenge). Submitting
  // in that state would only earn a TURNSTILE_VERIFICATION_FAILED from the
  // server, so the submit handler stops it here and says so instead.
  const turnstilePending = Boolean(turnstileSiteKey) && !turnstileToken;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (turnstilePending) {
      setError(t("turnstileNotReady"));
      return;
    }
    setEmailNotVerified(false);
    setResendSent(false);

    const data = await post<LoginResponse>(
      "/api/auth/login",
      { email, password, turnstileToken },
      {
        onFailure: (failure) => {
          if (failure.errorCode === "EMAIL_NOT_VERIFIED") {
            setEmailNotVerified(true);
          }
        },
      },
    );
    if (!data) {
      // The token just spent can't be reused, so hand the visitor a fresh
      // challenge before they retry.
      turnstileRef.current?.reset();
      return;
    }

    if (data.twoFactorRequired) {
      // This step's widget unmounts as the second-factor step takes over;
      // drop its spent token so coming back here can't submit it again.
      setTurnstileToken("");
      if (data.twoFactorMethod === "totp") {
        setTotpRequired(true);
      } else {
        setChallengeToken(data.challengeToken ?? null);
      }
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleResendVerification() {
    setResendSubmitting(true);
    setResendSent(false);

    // Deliberately not routed through usePostJson: this endpoint always
    // answers neutrally (see app/api/auth/resend-verification/route.ts), so
    // there is no ok/errorCode branch to take.
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });

    setResendSubmitting(false);
    setResendSent(true);
  }

  if (totpRequired) {
    return (
      <TotpStep
        email={email}
        password={password}
        turnstileSiteKey={turnstileSiteKey}
        onBack={() => setTotpRequired(false)}
      />
    );
  }

  if (challengeToken) {
    return (
      <EmailOtpStep
        challengeToken={challengeToken}
        onBack={() => setChallengeToken(null)}
        onChallengeSpent={(message) => {
          setChallengeToken(null);
          setError(message);
        }}
      />
    );
  }

  return (
    <AuthFormShell
      title={t("title")}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel={t("submit")}
      submittingLabel={t("submitting")}
      error={error}
      footer={
        <div className="mt-4 flex flex-col gap-3">
          {emailNotVerified && (
            <div className="rounded-md border border-border bg-surface-muted p-3">
              {resendSent ? (
                <p className="text-sm text-ink-light">{t("resendVerificationSent")}</p>
              ) : (
                <>
                  <p className="text-sm text-ink-light">{t("resendVerificationPrompt")}</p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendSubmitting}
                    className="mt-2 font-medium text-interactive-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendSubmitting ? t("resendVerificationSubmitting") : t("resendVerificationButton")}
                  </button>
                </>
              )}
            </div>
          )}
          <PasskeyLoginButton />
          <p className="text-sm text-ink-light">
            {t("noAccount")}{" "}
            <Link href="/register" className="font-medium text-interactive-primary hover:underline">
              {t("registerLink")}
            </Link>
          </p>
        </div>
      }
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("email")}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("password")}
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <Link href="/forgot-password" className="text-sm text-interactive-primary hover:underline">
        {t("forgotPasswordLink")}
      </Link>
      {turnstileSiteKey && (
        <TurnstileWidget ref={turnstileRef} siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      )}
    </AuthFormShell>
  );
}
