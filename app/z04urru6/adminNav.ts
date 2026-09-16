export interface AdminNavItem {
  label: string;
  href: string;
  section: "dashboard" | "commerce" | "content";
}

// "content" (首頁內容管理) — 合作鴿舍 (#34) is built on top of the generic
// CRUD from #33.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "總覽", href: "/z04urru6", section: "dashboard" },
  // 鴿子管理 (issue #287) — merges what used to be two separate nav entries,
  // "開放中商品" (/listings) and "建立商品" (/listings/new), into one, modeled
  // loosely on 商品管理 (#277)'s single-page list + create/edit entry point.
  // /listings/new remains its own standalone route/page (its form is too
  // complex for a modal) — the listings list page now just links to it via a
  // "＋新增商品" button instead of exposing a second nav item for it.
  { label: "鴿子管理", href: "/z04urru6/listings", section: "commerce" },
  { label: "已結標結算", href: "/z04urru6/listings/closed", section: "commerce" },
  // 商品管理 (issue #277) — standalone products/product_photos CRUD powering
  // the homepage carousel (issue #278) and /products/[id] detail page.
  // Deliberately independent of listings (see db/init.sql's products table
  // comment), so it sits alongside listings under "commerce" rather than
  // nested under "content" the way homepage_sections-backed screens are.
  { label: "商品管理", href: "/z04urru6/products", section: "commerce" },
  { label: "訂單管理", href: "/z04urru6/orders", section: "commerce" },
  { label: "使用者列表", href: "/z04urru6/users", section: "commerce" },
  { label: "合作鴿舍管理", href: "/z04urru6/homepage/partner-lofts", section: "content" },
  // 名家專區管理 (issue #270) — back to a homepage_sections-based curated
  // card admin (issue #176's independent featured_loft_posts article CMS is
  // removed), same "nested under /homepage/" placement as 合作鴿舍管理 above.
  { label: "名家專區管理", href: "/z04urru6/homepage/featured-lofts", section: "content" },
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
  // 鴿會查詢管理 (issue #260) — 手動維護一次性匯入腳本
  // (scripts/import-cb-pigeon-groups.mjs) 匯入的鴿會聯絡資訊。
  { label: "鴿會查詢管理", href: "/z04urru6/pigeon-groups", section: "content" },
];
