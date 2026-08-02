export interface AdminNavItem {
  label: string;
  href: string;
  section: "dashboard" | "commerce" | "content";
}

// "content" (首頁內容管理) items are deliberately not linked here yet — the
// pages themselves (合作鴿舍 / 入賞鴿 / 進口鴿管理 UI) are built by later
// tickets (#34/#35) on top of the CRUD API this ticket (#33) adds. This nav
// section is pre-reserved so those tickets only need to add entries, not
// introduce a new section.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "總覽", href: "/z04urru6", section: "dashboard" },
  { label: "開放中商品", href: "/z04urru6/listings", section: "commerce" },
  { label: "建立商品", href: "/z04urru6/listings/new", section: "commerce" },
  { label: "已結標結算", href: "/z04urru6/listings/closed", section: "commerce" },
  { label: "訂單管理", href: "/z04urru6/orders", section: "commerce" },
  { label: "使用者列表", href: "/z04urru6/users", section: "commerce" },
  { label: "電子報", href: "/z04urru6/newsletter", section: "commerce" },
];