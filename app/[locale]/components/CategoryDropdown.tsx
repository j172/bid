"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export interface PartnerLoftSummary {
  id: number;
  title: string;
}

interface CategoryDropdownProps {
  partnerLofts?: readonly PartnerLoftSummary[];
}

export default function CategoryDropdown({ partnerLofts = [] }: CategoryDropdownProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close when user navigates to a new page
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Click outside and Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-steel-azure-500 to-steel-azure-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:from-steel-azure-600 hover:to-steel-azure-800 focus:outline-none focus:ring-2 focus:ring-steel-azure-400 focus:ring-offset-2"
      >
        {t("allCategories")}
        <span
          aria-hidden="true"
          className={`inline-block transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label={t("allCategories")}
          className="absolute left-0 top-full z-50 mt-2.5 w-[680px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition animate-in fade-in"
        >
          <div className="grid grid-cols-3 gap-6 divide-x divide-slate-100">
            {/* Column 1: Trading & Auctions */}
            <div className="pr-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t("catTradingTitle")}
              </p>
              <div className="mt-3 space-y-1">
                <Link
                  href="/listings?type=auction"
                  onClick={() => setIsOpen(false)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">⚡</span>
                    <span className="text-xs font-bold text-ink group-hover:text-interactive-primary">
                      {t("catAuction")}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-6 text-[11px] text-ink-light">
                    {t("catAuctionDesc")}
                  </p>
                </Link>

                <Link
                  href="/listings?type=fixed_price"
                  onClick={() => setIsOpen(false)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">🏷️</span>
                    <span className="text-xs font-bold text-ink group-hover:text-interactive-primary">
                      {t("catFixedPrice")}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-6 text-[11px] text-ink-light">
                    {t("catFixedPriceDesc")}
                  </p>
                </Link>

                <Link
                  href="/listings?type=auction&sort=ends_soon&withinHours=6"
                  onClick={() => setIsOpen(false)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">⏳</span>
                    <span className="text-xs font-bold text-ink group-hover:text-interactive-primary">
                      {t("catEndingSoon")}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-6 text-[11px] text-ink-light">
                    {t("catEndingSoonDesc")}
                  </p>
                </Link>

                <div className="pt-2">
                  <Link
                    href="/listings"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center text-xs font-semibold text-interactive-primary hover:underline"
                  >
                    {t("catViewAllListings")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Column 2: Pigeon Showcase */}
            <div className="pl-4 pr-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t("catShowcaseTitle")}
              </p>
              <div className="mt-3 space-y-1">
                <Link
                  href="/pigeon-showcase?category=award"
                  onClick={() => setIsOpen(false)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">🏆</span>
                    <span className="text-xs font-bold text-ink group-hover:text-interactive-primary">
                      {t("catAwardPigeons")}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-6 text-[11px] text-ink-light">
                    {t("catAwardPigeonsDesc")}
                  </p>
                </Link>

                <Link
                  href="/pigeon-showcase?category=imported"
                  onClick={() => setIsOpen(false)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">✈️</span>
                    <span className="text-xs font-bold text-ink group-hover:text-interactive-primary">
                      {t("catImportedPigeons")}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-6 text-[11px] text-ink-light">
                    {t("catImportedPigeonsDesc")}
                  </p>
                </Link>

                <Link
                  href="/pigeon-showcase?category=representative"
                  onClick={() => setIsOpen(false)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">👑</span>
                    <span className="text-xs font-bold text-ink group-hover:text-interactive-primary">
                      {t("catRepresentativePigeons")}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-6 text-[11px] text-ink-light">
                    {t("catRepresentativePigeonsDesc")}
                  </p>
                </Link>

                <div className="pt-2">
                  <Link
                    href="/pigeon-showcase"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center text-xs font-semibold text-interactive-primary hover:underline"
                  >
                    {t("catViewAllShowcase")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Column 3: Partner Lofts */}
            <div className="pl-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t("catLoftsTitle")}
              </p>
              <div className="mt-3 space-y-1">
                {partnerLofts.length > 0 ? (
                  partnerLofts.slice(0, 5).map((loft) => (
                    <Link
                      key={loft.id}
                      href={`/listings?loft=${loft.id}`}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-center gap-2 rounded-xl p-2.5 transition hover:bg-slate-50"
                    >
                      <span className="text-base" aria-hidden="true">🏠</span>
                      <span className="truncate text-xs font-bold text-ink group-hover:text-interactive-primary">
                        {loft.title}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="p-2.5 text-xs text-ink-light italic">
                    {t("catLoftsEmpty")}
                  </p>
                )}

                <div className="pt-2">
                  <Link
                    href="/listings"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center text-xs font-semibold text-interactive-primary hover:underline"
                  >
                    {t("catViewAllLofts")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
