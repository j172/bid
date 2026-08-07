import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import Image from "next/image";
import LanguageSwitcher from "./LanguageSwitcher";
import LogoutButton from "./LogoutButton";

export default async function SiteHeader() {
  const user = await getCurrentUser();
  const t = await getTranslations("nav");
  const quickSearches = [
    { label: t("quickAuction"), href: "/listings?type=auction" },
    { label: t("quickFixed"), href: "/listings?type=fixed_price" },
    { label: t("quickAutoBid"), href: "/#auto-bidding-explainer" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 text-ink shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-yale-blue-950 to-slate-950 text-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
          <p>{t("topbarNotice")}</p>
          <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white lg:hidden">
            🔒 {t("trustSecure")}
          </span>
          <div className="hidden items-center gap-2 text-[11px] text-white/90 lg:flex">
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-medium">🚚 {t("trustShipping")}</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-medium">🎧 {t("trustSupport")}</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-medium">🔒 {t("trustSecure")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/account" className="font-medium text-white hover:text-pacific-blue-200">
              {t("account")}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="mr-2 flex shrink-0 items-center gap-2 text-lg font-black tracking-tight sm:text-xl">
          <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Image
              src="/images/hero-placeholder.png"
              alt="Bid logo"
              width={36}
              height={36}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          {t("siteName")}
        </Link>

        <details className="relative lg:hidden ml-auto">
          <summary className="list-none rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-ink hover:border-interactive-primary">
            {t("menu")}
          </summary>
          <div className="absolute right-0 top-10 z-30 w-60 rounded-lg border border-border bg-white p-2 shadow-xl">
            <form action="/listings" className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 p-2">
              <select
                name="type"
                defaultValue=""
                className="w-20 shrink-0 rounded-md border border-border bg-white px-1.5 py-1.5 text-xs text-ink focus:border-interactive-primary focus:outline-none"
              >
                <option value="">{t("searchAll")}</option>
                <option value="auction">{t("searchAuction")}</option>
                <option value="fixed_price">{t("searchFixed")}</option>
              </select>
              <input
                type="search"
                name="q"
                placeholder={t("searchPlaceholderShort")}
                className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-xs text-ink placeholder:text-ink-light focus:border-interactive-primary focus:outline-none"
              />
              <button type="submit" className="rounded-md bg-header px-2 py-1.5 text-xs font-semibold text-white">
                {t("searchSubmit")}
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
                {t("contact")}
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
          <button type="button" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-pacific-blue-500 to-pacific-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm">
            {t("allCategories")}
            <span aria-hidden>▾</span>
          </button>

          <form action="/listings" className="relative min-w-0 flex-1">
            <div className="flex h-12 w-full overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
              <select
                name="type"
                defaultValue=""
                className="h-full w-32 shrink-0 border-r border-slate-200 bg-slate-50 px-3 text-xs font-medium text-ink focus:outline-none"
              >
                <option value="">{t("searchAll")}</option>
                <option value="auction">{t("searchAuction")}</option>
                <option value="fixed_price">{t("searchFixed")}</option>
              </select>
              <input
                type="search"
                name="q"
                placeholder={t("searchPlaceholder")}
                className="h-full min-w-0 flex-1 px-4 text-sm text-ink placeholder:text-ink-light focus:outline-none"
              />
            </div>
            <button type="submit" className="absolute right-[5px] top-[5px] inline-flex h-[38px] items-center rounded-full bg-slate-950 px-4 text-xs font-semibold leading-none text-white hover:bg-slate-800">
              {t("searchSubmit")}
            </button>
          </form>

          <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 leading-tight shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-ink-light">{t("supportPhoneLabel")}</p>
            <p className="text-xs font-bold text-ink">{t("supportPhone")}</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/cart" aria-label={t("cartLabel")} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-ink shadow-sm hover:border-interactive-primary hover:text-interactive-primary">
            <span aria-hidden>🛒</span>
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-header px-1 text-[10px] text-white">0</span>
          </Link>

          {user ? (
            <>
              <Link href="/account" className="hidden max-w-44 truncate rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-interactive-primary sm:inline">
                {user.email}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-interactive-primary">
                {t("login")}
              </Link>
              <Link href="/register" className="rounded-md bg-header px-3 py-2 text-sm font-semibold text-white hover:bg-header-soft">
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="hidden border-t border-slate-200 bg-gradient-to-b from-white to-slate-50 lg:block">
        <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
          <nav className="flex min-w-0 flex-wrap items-center gap-5 text-sm text-ink">
            <Link href="/" className="font-medium hover:text-interactive-primary">
              {t("home")}
            </Link>
            <Link href="/listings" className="font-medium hover:text-interactive-primary">
              {t("browse")}
            </Link>
            <Link href="/contact" className="font-medium hover:text-interactive-primary">
              {t("contact")}
            </Link>
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
          </nav>

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-2.5">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className="shrink-0 font-semibold text-ink-light">{t("trendingSearches")}</span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {quickSearches.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-ink shadow-sm hover:border-interactive-primary hover:text-interactive-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
