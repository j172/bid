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
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 text-ink shadow-sm backdrop-blur">
      <div className="border-b border-border bg-slate-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-ink-light sm:px-6">
          <p>{t("topbarNotice")}</p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/account" className="font-medium text-ink hover:text-brand-blue">
              {t("account")}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="mr-2 flex items-center gap-2 shrink-0 text-lg font-black tracking-tight sm:text-xl">
          <span className="rounded-md bg-header px-2 py-1 text-xs font-bold text-white">BID</span>
          {t("siteName")}
        </Link>

        <details className="relative lg:hidden ml-auto">
          <summary className="list-none rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand-blue">
            {t("menu")}
          </summary>
          <div className="absolute right-0 top-10 z-30 w-60 rounded-lg border border-border bg-white p-2 shadow-xl">
            <form action="/listings" className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 p-2">
              <input
                type="search"
                name="q"
                placeholder="搜尋商品..."
                className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-xs text-ink placeholder:text-ink-light focus:border-brand-blue focus:outline-none"
              />
              <button type="submit" className="rounded-md bg-header px-2 py-1.5 text-xs font-semibold text-white">
                Go
              </button>
            </form>

            <nav className="flex flex-col text-sm text-ink">
              <Link href="/" className="rounded-md px-3 py-2 hover:bg-slate-100">
                {t("home")}
              </Link>
              <Link href="/listings" className="rounded-md px-3 py-2 hover:bg-slate-100">
                {t("browse")}
              </Link>
              <Link href="/contact" className="rounded-md px-3 py-2 hover:bg-slate-100">
                聯絡我們
              </Link>
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
            </nav>
          </div>
        </details>

        <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
          <button type="button" className="inline-flex shrink-0 items-center gap-2 rounded-md bg-header px-3 py-2 text-xs font-semibold text-white">
            {t("allCategories")}
            <span aria-hidden>▾</span>
          </button>

          <form action="/listings" className="relative min-w-0 flex-1">
            <input
              type="search"
              name="q"
              placeholder="搜尋商品、品牌或關鍵字..."
              className="h-10 w-full rounded-md border border-border bg-white pl-3 pr-20 text-sm text-ink placeholder:text-ink-light focus:border-brand-blue focus:outline-none"
            />
            <button type="submit" className="absolute right-1 top-1 inline-flex h-8 items-center rounded-md bg-header px-3 text-xs font-semibold text-white hover:bg-header-soft">
              Search
            </button>
          </form>

          <div className="shrink-0 rounded-md border border-border px-3 py-2 leading-tight">
            <p className="text-[11px] uppercase tracking-wide text-ink-light">客服專線</p>
            <p className="text-xs font-bold text-ink">(+886) 02-1234-5678</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/wishlist" aria-label="Wishlist" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink hover:border-brand-blue hover:text-brand-blue">
            <span aria-hidden>♡</span>
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-header px-1 text-[10px] text-white">0</span>
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink hover:border-brand-blue hover:text-brand-blue">
            <span aria-hidden>🛒</span>
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-header px-1 text-[10px] text-white">0</span>
          </Link>

          {user ? (
            <>
              <Link href="/account" className="hidden max-w-44 truncate rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-brand-blue sm:inline">
                {user.email}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-brand-blue">
                {t("login")}
              </Link>
              <Link href="/register" className="rounded-md bg-header px-3 py-2 text-sm font-semibold text-white hover:bg-header-soft">
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="hidden border-t border-border bg-white lg:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm sm:px-6">
          <nav className="flex min-w-0 flex-wrap items-center gap-5 text-ink">
            <Link href="/" className="font-medium hover:text-brand-blue">
              {t("home")}
            </Link>
            <Link href="/listings" className="font-medium hover:text-brand-blue">
              {t("browse")}
            </Link>
            <Link href="/contact" className="font-medium hover:text-brand-blue">
              聯絡
            </Link>
            {user && (
              <Link href="/my-bids" className="font-medium hover:text-brand-blue">
                {t("myBids")}
              </Link>
            )}
            {user?.role === "admin" && (
              <NextLink href="/z04urru6" className="font-medium hover:text-brand-blue">
                {t("admin")}
              </NextLink>
            )}
          </nav>

          <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand-blue">Premium Auction Experience</p>
        </div>
      </div>
    </header>
  );
}
