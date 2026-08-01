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
    <header className="bg-header text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          {t("siteName")}
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-sm">
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

        <div className="flex items-center gap-3 text-sm">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link href="/account" className="hidden hover:text-gold-light sm:inline">
                {user.email}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-gold-light">
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-gold px-3 py-1.5 font-medium text-white hover:bg-gold-dark"
              >
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
