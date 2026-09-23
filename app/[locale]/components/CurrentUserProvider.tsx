"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Issue #354: app/[locale]/layout.tsx and SiteHeader.tsx both used to call
// lib/auth's getCurrentUser() directly during server render to decide
// logged-in vs. logged-out UI (GoogleOneTap's visibility, and SiteHeader's
// nav/account links). getCurrentUser() reads next/headers' cookies(), a
// Next.js "dynamic API" — under this Next.js version's non-cacheComponents
// caching model, a cookies()/headers() read ANYWHERE in a route's render
// tree forces the ENTIRE [locale]-scoped route segment to server-render on
// every request, overriding any child page's `export const revalidate`
// (see #346/#353). Suspense boundaries don't change this without
// Partial Prerendering, which next.config.js does not enable.
//
// The fix moves the auth-state read to the client: this single context
// fetches GET /api/auth/me once on mount and shares the result with every
// consumer (GoogleOneTap's visibility gate, SiteHeader's account/login
// links) so the server render path for every page under [locale] no longer
// touches cookies() at all.
//
// Deliberately a plain type here (not imported from lib/auth) — that module
// pulls in "next/headers" and Node's "crypto" at module scope, neither of
// which can run in a client bundle. /api/auth/me's response shape is the
// actual contract this file depends on.
export interface CurrentUser {
  id: number;
  email: string;
  role: "admin" | "user";
}

interface CurrentUserState {
  /** null while `loading` is true (auth state not yet known — treat as
   * "unknown", not "logged out") or once resolved with no active session. */
  user: CurrentUser | null;
  /** true until the first /api/auth/me response (success or failure)
   * arrives. Consumers should render a neutral/skeleton state while this is
   * true rather than assuming logged-out, to avoid a flash of the wrong
   * auth UI for already-authenticated visitors. */
  loading: boolean;
}

const CurrentUserContext = createContext<CurrentUserState>({ user: null, loading: true });

export function useCurrentUser(): CurrentUserState {
  return useContext(CurrentUserContext);
}

export default function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CurrentUserState>({ user: null, loading: true });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`unexpected status ${res.status}`))))
      .then((data: { user?: CurrentUser | null }) => {
        if (!cancelled) setState({ user: data.user ?? null, loading: false });
      })
      .catch(() => {
        // Network/parse failure: fall back to "logged out" rather than
        // leaving the UI stuck in the loading/skeleton state forever.
        if (!cancelled) setState({ user: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <CurrentUserContext.Provider value={state}>{children}</CurrentUserContext.Provider>;
}
