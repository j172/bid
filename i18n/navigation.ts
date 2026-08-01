import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers for next/link and next/navigation — use these
// (not the plain next/* versions) in every public page/component so
// navigation keeps the current locale's URL prefix automatically.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
