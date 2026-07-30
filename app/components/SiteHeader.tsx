import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="bg-header text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          拍賣競標
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/listings" className="hover:text-gold-light">
            瀏覽商品
          </Link>
          {user && (
            <Link href="/my-bids" className="hover:text-gold-light">
              我的出價紀錄
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/z04urru6" className="hover:text-gold-light">
              後台
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden text-gray-300 sm:inline">{user.email}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-gold-light">
                登入
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-gold px-3 py-1.5 font-medium text-white hover:bg-gold-dark"
              >
                註冊
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
