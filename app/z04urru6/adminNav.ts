export interface AdminNavItem {
  label: string;
  href: string;
  section: "dashboard" | "commerce" | "content";
}

// "content" (首頁內容管理) — 合作鴿舍 (#34) is built on top of the generic
// CRUD from #33.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "總覽", href: "/z04urru6", section: "dashboard" },
  { label: "開放中商品", href: "/z04urru6/listings", section: "commerce" },
  { label: "建立商品", href: "/z04urru6/listings/new", section: "commerce" },
  { label: "已結標結算", href: "/z04urru6/listings/closed", section: "commerce" },
  { label: "訂單管理", href: "/z04urru6/orders", section: "commerce" },
  { label: "使用者列表", href: "/z04urru6/users", section: "commerce" },
  { label: "合作鴿舍管理", href: "/z04urru6/homepage/partner-lofts", section: "content" },
  // 名家專區管理 (issue #176) — replaces issue #168's homepage_sections-based
  // implementation (was at /z04urru6/homepage/featured-lofts) with its own
  // independent CRUD on the new featured_loft_posts table, same "top-level
  // route, not nested under /homepage/" placement as 最新訊息 below.
  { label: "名家專區管理", href: "/z04urru6/featured-lofts", section: "content" },
  // 入賞鴿／進口鴿管理 (issue #54) — deliberately NOT a revival of the
  // pigeon_gallery_* admin UI removed by #52; a brand-new, simpler CRUD on
  // top of the new pigeon_showcase table (two fixed categories, no
  // custom-category management).
  { label: "入賞鴿／進口鴿管理", href: "/z04urru6/pigeon-showcase", section: "content" },
  // 最新訊息管理 (issue #56) — public announcement CRUD. Issue #80 folded the
  // standalone "電子報" (Newsletter) nav item into this one: sending a
  // newsletter is now an option on this form, not a separate admin section.
  { label: "最新訊息管理", href: "/z04urru6/news", section: "content" },
  // 官方影音管理 — 管理首頁「官方社群影音動態」專區指定播放之 YouTube 影片（最多 6 則）。
  { label: "官方影音管理", href: "/z04urru6/homepage-videos", section: "content" },
  // 取鴿站管理 (issue #242) — 手動維護 pigeon_stations，資料最初由
  // scripts/import-pigeon-stations.mjs 一次性匯入 nicepigeon.com 名錄。
  { label: "取鴿站管理", href: "/z04urru6/pigeon-stations", section: "content" },
  // 鴿店地圖目錄管理 (issue #243) — 手動維護一次性匯入腳本
  // (scripts/import-pigeon-shops.mjs) 匯入的鴿店聯絡資訊。
  { label: "鴿店地圖目錄管理", href: "/z04urru6/pigeon-shops", section: "content" },
  // 賽事管理 (issue #255) — minimal admin page for issue #241's races
  // feature: manual sync trigger + read-only list, no CRUD (see
  // app/z04urru6/races/page.tsx's header comment for why).
  { label: "賽事管理", href: "/z04urru6/races", section: "content" },
];
