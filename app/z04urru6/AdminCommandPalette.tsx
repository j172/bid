"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LISTING_TYPE_LABEL } from "@/lib/listingTypeLabel";
import { ADMIN_NAV_ITEMS } from "./adminNav";

interface SearchListing {
  id: number;
  title: string;
  listingType: "auction" | "fixed_price";
  status: string;
}

interface SearchUser {
  id: number;
  email: string;
  displayName: string | null;
  role: "admin" | "user";
}

interface SearchPayload {
  listings: SearchListing[];
  users: SearchUser[];
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface PaletteSection {
  key: string;
  icon: string;
  title: string;
  items: PaletteItem[];
  emptyText: string;
}

interface RecentCommand {
  href: string;
  title: string;
  subtitle: string;
}

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const QUICK_ACTIONS: ActionItem[] = [
  { id: "new-listing", title: "建立新商品", subtitle: "快速前往建立商品頁", href: "/z04urru6/listings/new" },
  {
    id: "unsettled-orders",
    title: "查看未結算訂單",
    subtitle: "訂單管理：交易狀態 = 尚未完成",
    href: "/z04urru6/orders?status=unsettled",
  },
  {
    id: "unsettled-listings",
    title: "查看未結算拍賣",
    subtitle: "已結標結算：交易狀態 = 尚未完成",
    href: "/z04urru6/listings/closed?status=unsettled",
  },
  {
    id: "low-stock",
    title: "查看低庫存商品",
    subtitle: "開放中商品：排序庫存由少到多",
    href: "/z04urru6/listings?sort=stock_asc&type=fixed_price",
  },
];

const RECENT_COMMANDS_STORAGE_KEY = "bid-admin-recent-commands";
const MAX_RECENT_COMMANDS = 6;
const PAGE_JUMP_SIZE = 6;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreItem(item: Pick<PaletteItem, "title" | "subtitle" | "href">, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = item.title.toLowerCase();
  const subtitle = item.subtitle.toLowerCase();
  const href = item.href.toLowerCase();

  if (title === q) return 1000;
  if (title.startsWith(q)) return 700;
  if (title.includes(q)) return 500;
  if (subtitle.startsWith(q)) return 350;
  if (subtitle.includes(q)) return 250;
  if (href.includes(q)) return 120;
  return 0;
}

function sortByRelevance<T extends PaletteItem>(items: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return items;
  return [...items].sort((a, b) => scoreItem(b, q) - scoreItem(a, q));
}

export default function AdminCommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchPayload>({ listings: [], users: [] });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>([]);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_COMMANDS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecentCommand[];
      if (Array.isArray(parsed)) {
        setRecentCommands(
          parsed.filter(
            (item) =>
              typeof item?.href === "string" && typeof item?.title === "string" && typeof item?.subtitle === "string",
          ),
        );
      }
    } catch {
      setRecentCommands([]);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLoading(false);
      setResults({ listings: [], users: [] });
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults({ listings: [], users: [] });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/command-palette/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { ok: boolean; listings?: SearchListing[]; users?: SearchUser[] };
        if (!response.ok || !data.ok) {
          setResults({ listings: [], users: [] });
          return;
        }
        setResults({ listings: data.listings ?? [], users: data.users ?? [] });
      } catch {
        setResults({ listings: [], users: [] });
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [open, query]);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_NAV_ITEMS;
    return ADMIN_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q));
  }, [query]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_ACTIONS;
    return QUICK_ACTIONS.filter(
      (item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.href.toLowerCase().includes(q),
    );
  }, [query]);

  const navItems = useMemo<PaletteItem[]>(
    () =>
      sortByRelevance(
        filteredNav.map((item) => ({
        id: `nav-${item.href}`,
        title: item.label,
        subtitle: item.href,
        href: item.href,
        })),
        query,
      ),
    [filteredNav, query],
  );

  const actionItems = useMemo<PaletteItem[]>(
    () =>
      sortByRelevance(
        filteredActions.map((item) => ({
        id: `action-${item.id}`,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        })),
        query,
      ),
    [filteredActions, query],
  );

  const listingItems = useMemo<PaletteItem[]>(
    () =>
      sortByRelevance(
        results.listings.map((listing) => ({
        id: `listing-${listing.id}`,
        title: listing.title,
        subtitle: `#${listing.id} ・ ${LISTING_TYPE_LABEL[listing.listingType]} ・ ${listing.status}`,
        href: `/listings/${listing.id}`,
        })),
        query,
      ),
    [query, results.listings],
  );

  const userItems = useMemo<PaletteItem[]>(
    () =>
      sortByRelevance(
        results.users.map((user) => ({
        id: `user-${user.id}`,
        title: user.displayName ?? user.email,
        subtitle: `${user.email} ・ ${user.role === "admin" ? "管理員" : "一般使用者"}`,
        href: `/z04urru6/users/${user.id}`,
        })),
        query,
      ),
    [query, results.users],
  );

  const recentItems = useMemo<PaletteItem[]>(
    () =>
      recentCommands.map((item) => ({
        id: `recent-${item.href}`,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
      })),
    [recentCommands],
  );

  const allSelectableItems = useMemo<PaletteItem[]>(() => {
    return [...recentItems, ...navItems, ...actionItems, ...listingItems, ...userItems];
  }, [actionItems, listingItems, navItems, recentItems, userItems]);

  const sections = useMemo<PaletteSection[]>(() => {
    const hasSearchQuery = query.trim().length >= 2;
    return [
      {
        key: "recent",
        icon: "🕘",
        title: "最近命令",
        items: recentItems,
        emptyText: "尚未有最近命令，執行後會顯示在這裡。",
      },
      {
        key: "nav",
        icon: "🧭",
        title: "導覽",
        items: navItems,
        emptyText: "沒有符合的頁面。",
      },
      {
        key: "actions",
        icon: "⚡",
        title: "快速動作",
        items: actionItems,
        emptyText: "沒有符合的動作。",
      },
      {
        key: "listings",
        icon: "📦",
        title: loading ? "商品（搜尋中...）" : "商品",
        items: listingItems,
        emptyText: hasSearchQuery ? "沒有符合的商品" : "輸入至少 2 字開始搜尋",
      },
      {
        key: "users",
        icon: "👤",
        title: loading ? "使用者（搜尋中...）" : "使用者",
        items: userItems,
        emptyText: hasSearchQuery ? "沒有符合的使用者" : "輸入至少 2 字開始搜尋",
      },
    ];
  }, [actionItems, loading, navItems, query, recentItems, listingItems, userItems]);

  const indexMap = useMemo(() => {
    return allSelectableItems.reduce<Record<string, number>>((acc, item, index) => {
      acc[item.id] = index;
      return acc;
    }, {});
  }, [allSelectableItems]);

  useEffect(() => {
    if (selectedIndex >= allSelectableItems.length) {
      setSelectedIndex(0);
    }
  }, [allSelectableItems, selectedIndex]);

  useEffect(() => {
    const active = allSelectableItems[selectedIndex];
    if (!active) return;
    const element = itemRefs.current[active.id];
    element?.scrollIntoView({ block: "nearest" });
  }, [allSelectableItems, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (allSelectableItems.length === 0) return;
        setSelectedIndex((prev) => (prev + 1) % allSelectableItems.length);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (allSelectableItems.length === 0) return;
        setSelectedIndex((prev) => (prev - 1 + allSelectableItems.length) % allSelectableItems.length);
      }
      if (event.key === "Enter") {
        const active = allSelectableItems[selectedIndex];
        if (!active) return;
        event.preventDefault();
        go(active);
      }
      if (event.key === "Home") {
        event.preventDefault();
        if (allSelectableItems.length === 0) return;
        setSelectedIndex(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        if (allSelectableItems.length === 0) return;
        setSelectedIndex(allSelectableItems.length - 1);
      }
      if (event.key === "PageDown") {
        event.preventDefault();
        if (allSelectableItems.length === 0) return;
        setSelectedIndex((prev) => Math.min(allSelectableItems.length - 1, prev + PAGE_JUMP_SIZE));
      }
      if (event.key === "PageUp") {
        event.preventDefault();
        if (allSelectableItems.length === 0) return;
        setSelectedIndex((prev) => Math.max(0, prev - PAGE_JUMP_SIZE));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allSelectableItems, open, selectedIndex]);

  if (!open) return null;

  function go(item: Pick<PaletteItem, "href" | "title" | "subtitle">) {
    const nextRecent: RecentCommand[] = [
      { href: item.href, title: item.title, subtitle: item.subtitle },
      ...recentCommands.filter((recent) => recent.href !== item.href),
    ].slice(0, MAX_RECENT_COMMANDS);
    setRecentCommands(nextRecent);
    window.localStorage.setItem(RECENT_COMMANDS_STORAGE_KEY, JSON.stringify(nextRecent));
    onClose();
    router.push(item.href);
  }

  function itemClass(index: number): string {
    return [
      "flex w-full rounded-lg px-3 py-2 text-left transition",
      selectedIndex === index ? "bg-interactive-primary-subtle ring-1 ring-interactive-primary/40" : "hover:bg-surface-muted",
    ].join(" ");
  }

  function findIndexById(id: string): number {
    return indexMap[id] ?? -1;
  }

  function renderSection(section: PaletteSection, className?: string) {
    const keyword = query.trim();

    function highlightText(text: string) {
      if (!keyword) return text;
      const regex = new RegExp(`(${escapeRegExp(keyword)})`, "ig");
      const parts = text.split(regex);
      if (parts.length <= 1) return text;
      const keywordLower = keyword.toLowerCase();
      return parts.map((part, index) =>
        part.toLowerCase() === keywordLower ? (
          <mark key={`${part}-${index}`} className="rounded bg-interactive-primary-subtle px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      );
    }

    return (
      <section key={section.key} className={className}>
        <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-light">
          <span>
            {section.icon} {section.title}
          </span>
          <span className="rounded bg-surface-muted px-1.5 py-0.5">{section.items.length}</span>
        </h3>

        {section.items.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-light">{section.emptyText}</p>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label={section.title}>
            {section.items.map((item) => {
              const index = findIndexById(item.id);
              return (
                <li key={item.id}>
                  <button
                    id={`palette-item-${item.id}`}
                    type="button"
                    role="option"
                    ref={(el) => {
                      itemRefs.current[item.id] = el;
                    }}
                    onClick={() => go(item)}
                    onMouseEnter={() => {
                      if (index >= 0) setSelectedIndex(index);
                    }}
                    onFocus={() => {
                      if (index >= 0) setSelectedIndex(index);
                    }}
                    className={`${itemClass(index)} flex-col`}
                    aria-selected={selectedIndex === index}
                    aria-label={`${item.title}，${item.subtitle}`}
                  >
                    <span className="truncate">{highlightText(item.title)}</span>
                    <span className="text-xs text-ink-light">{highlightText(item.subtitle)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-20" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="管理後台快速命令面板"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋頁面、動作、商品、使用者..."
            className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none"
          />
          <p className="mt-2 text-xs text-ink-light">
            提示：輸入 2 個字以上會搜尋資料庫（商品/使用者），使用 ↑ ↓ / PgUp PgDn / Home End 導覽、Enter 執行、Esc 關閉。
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 text-sm">
          <p className="sr-only" aria-live="polite">
            目前共有 {allSelectableItems.length} 筆可選命令
          </p>
          {sections.map((section, index) => renderSection(section, index === 0 ? undefined : "mt-5"))}
        </div>
      </div>
    </div>
  );
}