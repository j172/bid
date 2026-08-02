export interface AdminNavItem {
  label: string;
  href: string;
  section: "dashboard" | "commerce" | "content";
}

// "content" (首頁內容管理) items — 合作鴿舍 (#34) is still not linked here
// (that ticket hasn't built its admin UI yet); this ticket (#35) adds the
// 入賞鴿／進口鴿 gallery entries. Items management has no direct nav entry
// since it always requires a categoryId — it's reached via the "管理項目"
// link on the categories page instead.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "總覽", href: "/z04urru6", section: "dashboard" },
  { label: "開放中商品", href: "/z04urru6/listings", section: "commerce" },
  { label: "建立商品", href: "/z04urru6/listings/new", section: "commerce" },
  { label: "已結標結算", href: "/z04urru6/listings/closed", section: "commerce" },
  { label: "訂單管理", href: "/z04urru6/orders", section: "commerce" },
  { label: "使用者列表", href: "/z04urru6/users", section: "commerce" },
  { label: "電子報", href: "/z04urru6/newsletter", section: "commerce" },
  { label: "入賞鴿／進口鴿分類", href: "/z04urru6/homepage/pigeon-gallery/categories", section: "content" },
];