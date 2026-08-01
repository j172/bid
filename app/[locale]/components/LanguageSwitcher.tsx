"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-300">
      <span className="hidden sm:inline">{t("label")}</span>
      <select
        aria-label={t("label")}
        value={locale}
        onChange={(e) =>
          // @ts-expect-error -- next-intl can't statically verify params match
          // this pathname, but they always do since both come from the same
          // current route (see next-intl's LocaleSwitcher example).
          router.replace({ pathname, params }, { locale: e.target.value })
        }
        className="rounded-md border border-white/30 bg-header px-2 py-1 text-white"
      >
        {routing.locales.map((value) => (
          <option key={value} value={value} className="text-ink">
            {t(value)}
          </option>
        ))}
      </select>
    </label>
  );
}
