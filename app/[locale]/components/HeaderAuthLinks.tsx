"use client";

// Issue #354: the login/logout-dependent fragments of SiteHeader, split out
// as client components so SiteHeader itself (a server component) no longer
// needs to call getCurrentUser() during render. Each of these consumes the
// shared CurrentUserProvider context (mounted once in app/[locale]/layout.tsx)
// instead of doing its own fetch.
//
// Three separate components, not one, because the three usages sit in
// structurally different parts of SiteHeader's markup (the mobile <details>
// dropdown, the desktop top-bar actions, and the secondary desktop nav row)
// — they can't be collapsed into a single rendered fragment.

import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import LogoutButton from "./LogoutButton";
import { useCurrentUser } from "./CurrentUserProvider";

/** Mobile <details> dropdown: my-bids/admin links when logged in, login/register when not. */
export function HeaderMobileAuthLinks() {
  const t = useTranslations("nav");
  const { user, loading } = useCurrentUser();

  // While auth state is unknown, render nothing rather than guessing.
  // This menu is collapsed by default, so by the time a visitor opens it
  // the fetch has almost always already resolved.
  if (loading) return null;

  return (
    <>
      {user && (
        <Link href="/my-bids" className="rounded-md px-3 py-2 hover:bg-slate-100">
          {t("myBids")}
        </Link>
      )}
      {user?.role === "admin" && (
        <NextLink href="/z04urru6" className="rounded-md px-3 py-2 hover:bg-slate-100">
          {t("admin")}
        </NextLink>
      )}
      {!user && (
        <>
          <Link href="/login" className="rounded-md px-3 py-2 hover:bg-slate-100">
            {t("login")}
          </Link>
          <Link href="/register" className="rounded-md px-3 py-2 hover:bg-slate-100">
            {t("register")}
          </Link>
        </>
      )}
    </>
  );
}

/** Desktop top-bar actions: account link + logout, or login/register buttons. */
export function HeaderDesktopAuthActions() {
  const t = useTranslations("nav");
  const { user, loading } = useCurrentUser();

  // This is the one spot where "logged out" and "logged in" render visibly
  // different, prominent UI (login/register buttons vs. account + logout).
  // Showing a neutral skeleton here (rather than defaulting to logged-out)
  // avoids a flash of the wrong state for already-authenticated visitors.
  if (loading) {
    return (
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-9 w-24 animate-pulse rounded-md bg-slate-100" />
        <span className="h-9 w-20 animate-pulse rounded-md bg-slate-100" />
      </div>
    );
  }

  if (user) {
    return (
      <>
        <Link
          href="/account"
          className="hidden max-w-44 truncate rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-interactive-primary sm:inline"
        >
          {user.email}
        </Link>
        <LogoutButton />
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-interactive-primary">
        {t("login")}
      </Link>
      <Link href="/register" className="rounded-md bg-header px-3 py-2 text-sm font-semibold text-white hover:bg-header-soft">
        {t("register")}
      </Link>
    </>
  );
}

/** Secondary desktop nav row: my-bids/admin links, shown only when logged in. */
export function HeaderBottomAuthLinks() {
  const t = useTranslations("nav");
  const { user, loading } = useCurrentUser();

  if (loading) return null;

  return (
    <>
      {user && (
        <Link href="/my-bids" className="font-medium hover:text-interactive-primary">
          {t("myBids")}
        </Link>
      )}
      {user?.role === "admin" && (
        <NextLink href="/z04urru6" className="font-medium hover:text-interactive-primary">
          {t("admin")}
        </NextLink>
      )}
    </>
  );
}
