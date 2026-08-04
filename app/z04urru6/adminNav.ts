export interface AdminNavItem {
  label: string;
  href: string;
  section: "dashboard" | "commerce" | "content";
}

// "content" (首頁內容管理) — 合作鴿舍 (#34) and 入賞鴿／進口鴿 gallery (#35)
// are both built on top of the generic CRUD from #33. Items management has
// no direct nav entry since it always requires a categoryId — it's reached
// via the "管理項目" link on the categories page instead.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "總覽", href: "/z04urru6", section: "dashboard" },
  { label: "開放中商品", href: "/z04urru6/listings", section: "commerce" },
  { label: "建立商品", href: "/z04urru6/listings/new", section: "commerce" },
  { label: "已結標結算", href: "/z04urru6/listings/closed", section: "commerce" },
  { label: "訂單管理", href: "/z04urru6/orders", section: "commerce" },
  { label: "使用者列表", href: "/z04urru6/users", section: "commerce" },
  { label: "電子報", href: "/z04urru6/newsletter", section: "commerce" },
  { label: "合作鴿舍管理", href: "/z04urru6/homepage/partner-lofts", section: "content" },
  { label: "入賞鴿／進口鴿管理", href: "/z04urru6/homepage/pigeon-gallery/categories", section: "content" },
];