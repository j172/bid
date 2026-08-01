import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import LogoutButton from "./LogoutButton";

export default async function SiteHeader() {
  const user = await getCurrentUser();
  const t = await getTranslations("nav");
  const quickSearches = [
    { label: t("quickAuction"), href: "/listings?type=auction" },
    { label: t("quickFixed"), href: "/listings?type=fixed_price" },
    { label: t("quickUnder500"), href: "/listings?minPrice=0&maxPrice=500" },
    { label: t("quickProxy"), href: "/listings?q=proxy" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 text-ink shadow-sm backdrop-blur">
      <div className="border-b border-border bg-slate-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-ink-light sm:px-6">
          <p>{t("topbarNotice")}</p>
          <div className="hidden items-center gap-2 text-[11px] text-ink lg:flex">
            <span className="rounded-full bg-white px-2 py-0.5 font-medium">🚚 {t("trustShipping")}</span>
            <span className="rounded-full bg-white px-2 py-0.5 font-medium">🎧 {t("trustSupport")}</span>
            <span className="rounded-full bg-white px-2 py-0.5 font-medium">🔒 {t("trustSecure")}</span>
          </div>
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
              <select
                name="type"
                defaultValue=""
                className="w-20 shrink-0 rounded-md border border-border bg-white px-1.5 py-1.5 text-xs text-ink focus:border-brand-blue focus:outline-none"
              >
                <option value="">{t("searchAll")}</option>
                <option value="auction">{t("searchAuction")}</option>
                <option value="fixed_price">{t("searchFixed")}</option>
              </select>
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
          <button type="button" className="inline-flex shrink-0 items-center gap-2 rounded-md bg-header px-3 py-2 text-xs font-semibold text-white">
            {t("allCategories")}
            <span aria-hidden>▾</span>
          </button>

          <form action="/listings" className="relative min-w-0 flex-1">
            <div className="flex h-10 w-full overflow-hidden rounded-md border border-border bg-white">
              <select
                name="type"
                defaultValue=""
                className="w-28 shrink-0 border-r border-border bg-slate-50 px-2 text-xs text-ink focus:outline-none"
              >
                <option value="">{t("searchAll")}</option>
                <option value="auction">{t("searchAuction")}</option>
                <option value="fixed_price">{t("searchFixed")}</option>
              </select>
              <input
                type="search"
                name="q"
                placeholder="搜尋商品、品牌或關鍵字..."
                className="min-w-0 flex-1 px-3 text-sm text-ink placeholder:text-ink-light focus:outline-none"
              />
            </div>
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
        <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between gap-4 text-sm">
            <nav className="flex min-w-0 flex-wrap items-center gap-5 text-ink">
              <Link href="/" className="font-medium hover:text-brand-blue">
                {t("home")}
              </Link>
              <Link href="/listings" className="font-medium hover:text-brand-blue">
                {t("browse")}
              </Link>
              <Link href="/contact" className="font-medium hover:text-brand-blue">
                {t("contact")}
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

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-border pt-2">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className="shrink-0 font-semibold text-ink-light">{t("trendingSearches")}</span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {quickSearches.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-border bg-slate-50 px-2.5 py-1 font-medium text-ink hover:border-brand-blue hover:text-brand-blue"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs">
              <Link href="/listings?sort=price_asc" className="rounded-md bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 hover:bg-amber-100">
                {t("dealZone")}
              </Link>
              <Link href="/listings?type=fixed_price&maxPrice=1000" className="rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100">
                {t("newbieZone")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
