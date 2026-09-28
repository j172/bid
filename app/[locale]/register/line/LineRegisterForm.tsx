"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { inputClass } from "@/lib/formStyles";
import { usePostJson, type ApiJsonResponse } from "@/lib/usePostJson";

interface OnboardData {
  displayName: string;
  email: string;
  picture: string | null;
  emailExists: boolean;
}

export default function LineRegisterForm() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("lineRegister");
  const tRegister = useTranslations("register");

  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [picture, setPicture] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Account linking state when email already exists
  const [linkingMode, setLinkingMode] = useState(false);
  const [password, setPassword] = useState("");

  const { post: postComplete, submitting: submittingComplete, error: errorComplete } = usePostJson(t("defaultError"));
  const { post: postLink, submitting: submittingLink, error: errorLink } = usePostJson(t("defaultError"));

  useEffect(() => {
    async function fetchOnboardInfo() {
      try {
        const res = await fetch("/api/auth/line/onboard-info");
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setExpired(true);
          return;
        }

        const data: OnboardData = json.data;
        setDisplayName(data.displayName || "");
        setEmail(data.email || "");
        setPicture(data.picture || null);
        if (data.emailExists) {
          setLinkingMode(true);
        }
      } catch {
        setExpired(true);
      } finally {
        setLoading(false);
      }
    }

    fetchOnboardInfo();
  }, []);

  async function handleCompleteSubmit(event: React.FormEvent) {
    event.preventDefault();

    interface CompleteRegResponse extends ApiJsonResponse {
      requireLink?: boolean;
    }

    const data = await postComplete<CompleteRegResponse>(
      "/api/auth/line/complete-registration",
      {
        displayName,
        email,
        phone,
        termsAccepted,
        locale,
      },
      {
        onFailure: (res) => {
          if (res.requireLink) {
            setLinkingMode(true);
          }
        },
      },
    );

    if (!data) return;

    router.push("/");
    router.refresh();
  }

  async function handleLinkSubmit(event: React.FormEvent) {
    event.preventDefault();

    const data = await postLink("/api/auth/line/link-existing", {
      email,
      password,
      locale,
    });

    if (!data) return;

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="flex justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
        </div>
      </main>
    );
  }

  if (expired) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-xl font-bold text-ink">{t("expiredTitle")}</h1>
          <p className="mt-3 text-sm text-ink-light">{t("expiredDescription")}</p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-md bg-[#06C755] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#05B04B]"
            >
              {t("retryButton")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture} alt={displayName} className="h-12 w-12 rounded-full object-cover border border-border" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#06C755]/10 text-lg font-bold text-[#06C755]">
              {displayName.slice(0, 1) || "L"}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
            <p className="text-xs text-ink-light">{t("subtitle")}</p>
          </div>
        </div>

        {linkingMode ? (
          <form onSubmit={handleLinkSubmit} className="mt-6 flex flex-col gap-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {t("linkingNotice", { email })}
            </div>

            {errorLink && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{errorLink}</div>
            )}

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              {t("accountPassword")}
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder={t("passwordPlaceholder")}
              />
            </label>

            <button
              type="submit"
              disabled={submittingLink}
              className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-[#06C755] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#05B04B] disabled:opacity-50"
            >
              {submittingLink ? t("linkingSubmitting") : t("linkingButton")}
            </button>

            <button
              type="button"
              onClick={() => setLinkingMode(false)}
              className="text-xs text-ink-light hover:underline"
            >
              {t("backToNewUser")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompleteSubmit} className="mt-6 flex flex-col gap-4">
            {errorComplete && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {errorComplete}
              </div>
            )}

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              {tRegister("displayName")}
              <input
                type="text"
                required
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              {tRegister("email")}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              {tRegister("phone")}
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912-345-678"
                className={inputClass}
              />
            </label>

            <div className="flex items-start gap-2 pt-2">
              <input
                id="terms"
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-interactive-primary focus:ring-interactive-primary"
              />
              <label htmlFor="terms" className="text-xs text-ink-light leading-relaxed">
                {tRegister("termsPrefix")}{" "}
                <Link
                  href="/auction-terms"
                  target="_blank"
                  className="font-medium text-interactive-primary hover:underline"
                >
                  {tRegister("auctionTermsLink")}
                </Link>{" "}
                {tRegister("termsAnd")}{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-interactive-primary hover:underline"
                >
                  {tRegister("privacyLink")}
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={submittingComplete}
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-[#06C755] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#05B04B] disabled:opacity-50"
            >
              {submittingComplete ? t("submitting") : t("submitButton")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
