"use client";

import { useEffect, useRef, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

interface GoogleSignInButtonProps {
  clientId?: string | null;
  onSuccess?: (user: { id: number; email: string; role: string }) => void;
  onTwoFactorRequired?: (data: { twoFactorMethod: string; challengeToken: string; email: string }) => void;
  className?: string;
}

export default function GoogleSignInButton({
  clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  onSuccess,
  onTwoFactorRequired,
  className = "",
}: GoogleSignInButtonProps) {
  const locale = useLocale();
  const t = useTranslations("login");
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  const handleCredentialResponse = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) return;

      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential, locale }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("Google sign-in failed", data);
          return;
        }

        if (data.twoFactorRequired) {
          if (onTwoFactorRequired) {
            onTwoFactorRequired({
              twoFactorMethod: data.twoFactorMethod,
              challengeToken: data.challengeToken || "",
              email: data.email || "",
            });
          } else {
            const params = new URLSearchParams({
              twoFactorRequired: "true",
              twoFactorMethod: data.twoFactorMethod,
              challengeToken: data.challengeToken || "",
              email: data.email || "",
            });
            router.push(`/login?${params.toString()}`);
          }
          return;
        }

        if (onSuccess) {
          onSuccess(data.user);
        } else {
          router.push("/");
          router.refresh();
        }
      } catch (err) {
        console.error("Failed to authenticate with Google", err);
      }
    },
    [locale, onSuccess, onTwoFactorRequired, router],
  );

  useEffect(() => {
    if (!clientId || typeof window === "undefined" || !containerRef.current) {
      return;
    }

    const interval = setInterval(() => {
      if (window.google?.accounts?.id && containerRef.current && !renderedRef.current) {
        clearInterval(interval);
        renderedRef.current = true;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "signin_with",
          locale,
          shape: "rectangular",
          logo_alignment: "left",
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [clientId, handleCredentialResponse, locale]);

  if (!clientId) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <div ref={containerRef} className="flex min-h-[44px] w-full justify-center">
        {/* Fallback button shown while Google GSI script loads */}
        <button
          type="button"
          onClick={() => {
            if (window.google?.accounts?.id) {
              window.google.accounts.id.prompt();
            }
          }}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink shadow-sm transition hover:bg-neutral-50 hover:shadow"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{t("googleSignIn")}</span>
        </button>
      </div>
    </div>
  );
}
