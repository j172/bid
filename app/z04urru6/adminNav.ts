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
  // 名家專區管理 (issue #168) — a second, fully independent CRUD page on the
  // same generic homepage_sections table as 合作鴿舍 above, using its own
  // section_type ('featured_loft') so the two never share or affect each
  // other's cards.
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
];