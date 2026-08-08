import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { resolveRayId } from "@/lib/rayId";
import CloudflareErrorPage from "../components/CloudflareErrorPage";
import AdminShell from "./AdminShell";
import "../globals.css";

// The admin backend is a second, independent root layout (its own <html>/
// <body>) — see app/[locale]/layout.tsx for the public site's root. There's
// deliberately no shared top-level app/layout.tsx: this tree stays entirely
// outside next-intl's routing (see middleware.ts's matcher) and untranslated.
export const metadata: Metadata = {
  title: "後台管理",
  description: "拍賣競標網站後台管理",
  icons: {
    icon: "/images/hero-placeholder.png",
    shortcut: "/images/hero-placeholder.png",
    apple: "/images/hero-placeholder.png",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

// Deliberately covers both "not logged in" and "logged in but not admin"
// with the same 403-styled response — see issue #65 (and issue #127 for
// how rayId below can now be a real, verified Cloudflare Ray ID) — rather than
// distinguishing them (e.g. redirecting the former to /login), so a random
// prober hitting this obscured path can't tell which case they're in.
//
// This renders the page directly instead of the previous redirect("/") so
// unauthorized access gets the same Cloudflare-styled treatment as the
// public site's 404/error pages (issue #65's acceptance criteria) rather
// than a silent bounce. Note this still returns an HTTP 200: Next's App
// Router only has first-class support for a non-200 status here via the
// experimental forbidden()/unauthorized() APIs (experimental.authInterrupts
// in next.config.js), which this change doesn't turn on — flagged for
// follow-up if a true 403 status code is needed, e.g. for monitoring/WAF
// rules that key off status codes rather than page content.
async function renderUnauthorized() {
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const rayId = resolveRayId(headersList);
  const timestamp = formatUtcTimestamp(new Date());

  return (
    <html lang="zh-Hant">
      <body className="min-h-screen font-sans">
        <CloudflareErrorPage
          errorCode="403"
          heading="禁止存取"
          status={{
            browser: { label: "瀏覽器", ok: true },
            cloudflare: { label: "Cloudflare", ok: true },
            host: { label: "主機", ok: false },
          }}
          statusOkText="正常"
          statusErrorText="錯誤"
          whatHappenedTitle="發生了什麼事？"
          whatHappened="您沒有權限存取這個頁面，可能是尚未登入，或登入的帳號不具備管理員權限。"
          whatCanIDoTitle="我可以怎麼做？"
          whatCanIDo="請確認您是使用管理員帳號登入；如果您認為這是誤判，請與網站管理員聯繫。"
          rayIdLabel="Ray ID"
          rayId={rayId}
          timestampLabel="時間戳記"
          timestamp={timestamp}
          yourIpLabel="您的 IP"
          clientIp={clientIp}
          ipUnknownText="無法取得"
          perfSecByText="效能與安全性由 Cloudflare 提供"
          homeHref="/"
          homeLabel="回首頁"
        />
      </body>
    </html>
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return renderUnauthorized();
  }

  return (
    <html lang="zh-Hant">
      <body className="min-h-screen font-sans text-ink">
        <AdminShell email={user.email}>{children}</AdminShell>
      </body>
    </html>
  );
}
