"use client";

import Script from "next/script";
import { useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

interface GoogleOneTapProps {
  clientId?: string | null;
  locale: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: unknown) => void;
          prompt: (notification?: (notification: unknown) => void) => void;
          renderButton: (parent: HTMLElement, options: unknown) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export default function GoogleOneTap({ clientId, locale }: GoogleOneTapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initializedRef = useRef(false);

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
          console.error("Google One Tap login failed", data);
          return;
        }

        if (data.twoFactorRequired) {
          const params = new URLSearchParams({
            twoFactorRequired: "true",
            twoFactorMethod: data.twoFactorMethod,
            challengeToken: data.challengeToken || "",
            email: data.email || "",
          });
          router.push(`/login?${params.toString()}`);
          return;
        }

        if (pathname === "/login" || pathname === "/register") {
          router.push("/");
          router.refresh();
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error("Failed to authenticate with Google One Tap", err);
      }
    },
    [locale, pathname, router],
  );

  const initGsi = useCallback(() => {
    if (!clientId || typeof window === "undefined" || !window.google?.accounts?.id) {
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false,
    });

    window.google.accounts.id.prompt();
  }, [clientId, handleCredentialResponse]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.google?.accounts?.id) {
      initGsi();
    }
  }, [initGsi]);

  if (!clientId) {
    return null;
  }

  return (
    <Script
      src={`https://accounts.google.com/gsi/client?hl=${locale}`}
      strategy="afterInteractive"
      onLoad={initGsi}
    />
  );
}
