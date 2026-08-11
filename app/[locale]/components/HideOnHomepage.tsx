"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

// Issue #150: SiteFooter is rendered once in the shared app/[locale]/layout.tsx
// for every page, so it has no page-level way to skip a child on just the
// homepage. This wraps that child instead, using `@/i18n/navigation`'s
// usePathname() (not next/navigation's) specifically because it already
// strips the locale prefix — the homepage is exactly "/" for all three
// locales, so no per-locale path list is needed here. Runs during SSR (it
// doesn't depend on anything client-only), so there's no flash of the child
// before it disappears.
export default function HideOnHomepage({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return <>{children}</>;
}
