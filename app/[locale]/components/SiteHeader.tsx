import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import LogoutButton from "./LogoutButton";

export default async function SiteHeader() {
  const user = await getCurrentUser();
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-header text-white shadow-lg">
      <div className="border-b border-slate-700/80 bg-header-soft">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-slate-300 sm:px-6">
          <p>{t("topbarNotice")}</p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/account" className="hover:text-white">
              {t("account")}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-white">
          <span className="rounded-md bg-gold px-2 py-0.5 text-sm">BID</span>
          {t("siteName")}
        </Link>

        <details className="relative lg:hidden">
          <summary className="list-none rounded-md border border-slate-600 px-3 py-1.5 text-sm font-semibold text-white hover:border-slate-300">
            {t("menu")}
          </summary>
          <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-slate-700 bg-header-soft p-2 shadow-xl">
            <nav className="flex flex-col text-sm text-slate-100">
              <Link href="/" className="rounded-md px-3 py-2 hover:bg-slate-800">
                {t("home")}
              </Link>
              <Link href="/listings" className="rounded-md px-3 py-2 hover:bg-slate-800">
                {t("browse")}
              </Link>
              {user && (
                <Link href="/my-bids" className="rounded-md px-3 py-2 hover:bg-slate-800">
                  {t("myBids")}
                </Link>
              )}
              {user?.role === "admin" && (
                <NextLink href="/z04urru6" className="rounded-md px-3 py-2 hover:bg-slate-800">
                  {t("admin")}
                </NextLink>
              )}
              {!user && (
                <>
                  <Link href="/login" className="rounded-md px-3 py-2 hover:bg-slate-800">
                    {t("login")}
                  </Link>
                  <Link href="/register" className="rounded-md px-3 py-2 hover:bg-slate-800">
                    {t("register")}
                  </Link>
                </>
              )}
            </nav>
          </div>
        </details>

        <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
          <div className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100">{t("allCategories")}</div>
          <nav className="flex min-w-0 flex-wrap items-center gap-4 text-sm text-slate-100">
            <Link href="/" className="hover:text-gold-light">
              {t("home")}
            </Link>
            <Link href="/listings" className="hover:text-gold-light">
              {t("browse")}
            </Link>
            {user && (
              <Link href="/my-bids" className="hover:text-gold-light">
                {t("myBids")}
              </Link>
            )}
            {user?.role === "admin" && (
              // Plain next/link, not the locale-aware Link above: /z04urru6 lives
              // entirely outside the [locale]-routed tree (see middleware.ts's
              // matcher), so it must never get a locale prefix like /zh-CN/z04urru6.
              <NextLink href="/z04urru6" className="hover:text-gold-light">
                {t("admin")}
              </NextLink>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-2 text-sm lg:flex">
          <Link href="/listings" className="rounded-md border border-slate-600 px-3 py-1.5 hover:border-slate-300">
            {t("explore")}
          </Link>
          {user ? (
            <>
              <Link href="/account" className="hidden max-w-40 truncate rounded-md bg-slate-800 px-3 py-1.5 sm:inline">
                {user.email}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md border border-slate-600 px-3 py-1.5 hover:border-slate-300">
                {t("login")}
              </Link>
              <Link href="/register" className="rounded-md bg-gold px-3 py-1.5 font-semibold text-white hover:bg-gold-dark">
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
